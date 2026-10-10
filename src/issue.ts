import { buildDiff, intersectGrants } from "./intersect.js";
import {
  epochAllows,
  isEpochTokenStore,
  type TokenStore,
} from "./store/index.js";
import { newJti, signToken, verifyToken } from "./token.js";
import type { Grant, IssueRequest, IssueResult, TokenClaims } from "./types.js";

async function parentRevoked(
  store: TokenStore,
  parent: TokenClaims,
): Promise<boolean> {
  if (isEpochTokenStore(store)) {
    return !epochAllows(parent.epoch, store.currentEpoch());
  }
  return await store.isRevoked(parent.jti);
}

type IssueFail = Extract<IssueResult, { ok: false }>;

function attenuateDelegatable(
  parentCaps: Grant[],
  requested: Grant[] | undefined,
): { ok: true; grants: Grant[] | undefined } | IssueFail {
  if (!requested?.length) return { ok: true, grants: requested };
  const d = intersectGrants(parentCaps, requested);
  if (!d.ok) {
    return {
      ok: false,
      reason: "privilege_escalation",
      diff: buildDiff({ excessGrants: d.excess }),
    };
  }
  return { ok: true, grants: d.grants };
}

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
  if (await parentRevoked(store, parent)) {
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

  const deleg = attenuateDelegatable(parentCaps, req.delegatable);
  if (!deleg.ok) return deleg;
  const childDelegatable = deleg.grants;

  if (req.expiresAt > parent.exp) {
    return {
      ok: false,
      reason: "expiry_exceeds_parent",
      diff: buildDiff({ expiryTooLong: true }),
    };
  }

  const nextDepth = parent.depth + 1;
  const maxDepth = req.maxDepth ?? parent.maxDepth;
  const kind = req.kind ?? "access";
  if (
    nextDepth > maxDepth ||
    (kind === "delegation" && nextDepth >= maxDepth)
  ) {
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
