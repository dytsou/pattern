import { buildDiff, intersectGrants } from "./intersect.js";
import { isEpochTokenStore, type TokenStore } from "./store/index.js";
import { newJti, signToken, verifyToken } from "./token.js";
import type { IssueRequest, IssueResult, TokenClaims } from "./types.js";

export async function issueChild(
  req: IssueRequest,
  secret: string,
  store: TokenStore,
  now = Date.now(),
): Promise<IssueResult> {
  const verified = await verifyToken(req.parent, secret, now);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }
  const parent = verified.claims;
  if (parent.kind !== "delegation") {
    return { ok: false, reason: "not_delegatable" };
  }
  if (isEpochTokenStore(store)) {
    if (parent.epoch !== store.currentEpoch()) {
      return { ok: false, reason: "revoked" };
    }
  } else if (await store.isRevoked(parent.jti)) {
    return { ok: false, reason: "revoked" };
  }

  const parentCaps = parent.delegatable ?? parent.grants;
  const grantResult = intersectGrants(parentCaps, req.grants);
  if (!grantResult.ok) {
    return {
      ok: false,
      reason: "privilege_escalation",
      diff: buildDiff({ excessGrants: grantResult.excess }),
    };
  }

  let childDelegatable = req.delegatable;
  if (childDelegatable?.length) {
    const d = intersectGrants(parentCaps, childDelegatable);
    if (!d.ok) {
      return {
        ok: false,
        reason: "privilege_escalation",
        diff: buildDiff({ excessGrants: d.excess }),
      };
    }
    childDelegatable = d.grants;
  }

  if (req.expiresAt > parent.exp) {
    return {
      ok: false,
      reason: "expiry_exceeds_parent",
      diff: buildDiff({ expiryTooLong: true }),
    };
  }

  const nextDepth = parent.depth + 1;
  const maxDepth = req.maxDepth ?? parent.maxDepth;
  if (nextDepth > maxDepth) {
    return {
      ok: false,
      reason: "depth_exceeded",
      diff: buildDiff({ depthExceeded: true }),
    };
  }

  const kind = req.kind ?? "access";
  if (kind === "delegation" && nextDepth >= maxDepth) {
    return {
      ok: false,
      reason: "depth_exceeded",
      diff: buildDiff({ depthExceeded: true }),
    };
  }

  const claims: TokenClaims = {
    jti: newJti(),
    kind,
    grants: grantResult.grants,
    delegatable:
      kind === "delegation"
        ? (childDelegatable ?? grantResult.grants)
        : undefined,
    exp: req.expiresAt,
    depth: nextDepth,
    maxDepth,
    parentJti: parent.jti,
    name: req.name,
  };
  if (isEpochTokenStore(store)) {
    claims.epoch = store.currentEpoch();
  }

  const token = await signToken(claims, secret);
  await store.put({
    jti: claims.jti,
    parentJti: parent.jti,
    kind: claims.kind,
    expiresAt: claims.exp,
  });

  return { ok: true, token, claims };
}
