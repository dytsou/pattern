import { decideFromClaims } from "./decide.js";
import { issueChild } from "./issue.js";
import {
  epochAllows,
  isEpochTokenStore,
  MemoryTokenStore,
  type TokenStore,
} from "./store/index.js";
import { newJti, signToken, verifyToken } from "./token.js";
import type {
  Decision,
  DenyReason,
  Grant,
  HttpMethod,
  IssueRequest,
  IssueResult,
  TokenClaims,
  TokenKind,
} from "./types.js";

export interface StaticRoot {
  name?: string;
  kind?: TokenKind;
  grants: Grant[];
  delegatable?: Grant[];
  /** unix seconds; default now+10y */
  exp?: number;
  maxDepth?: number;
}

export interface CreatePatternOptions {
  secret: string;
  store?: TokenStore;
  roots?: StaticRoot[];
}

export interface Pattern {
  secret: string;
  store: TokenStore;
  roots: { name?: string; token: string; claims: TokenClaims }[];
  verify(
    raw: string,
    now?: number,
  ): Promise<
    { ok: true; claims: TokenClaims } | { ok: false; reason: DenyReason }
  >;
  decide(
    rawToken: string | null,
    method: HttpMethod,
    path: string,
    now?: number,
  ): Promise<Decision>;
  issue(req: IssueRequest, now?: number): Promise<IssueResult>;
  revoke(jti: string, opts?: { cascade?: boolean }): Promise<void>;
  mintRoot(root: StaticRoot): Promise<{ token: string; claims: TokenClaims }>;
}

export async function createPattern(
  opts: CreatePatternOptions,
): Promise<Pattern> {
  const store = opts.store ?? new MemoryTokenStore();
  const roots: Pattern["roots"] = [];

  const api: Pattern = {
    secret: opts.secret,
    store,
    roots,
    async mintRoot(root) {
      const exp =
        root.exp ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10;
      const claims: TokenClaims = {
        jti: newJti(),
        kind: root.kind ?? "delegation",
        grants: root.grants,
        delegatable: root.delegatable ?? root.grants,
        exp,
        depth: 0,
        maxDepth: root.maxDepth ?? 8,
        name: root.name,
      };
      if (isEpochTokenStore(store)) {
        claims.epoch = store.currentEpoch();
      }
      const token = await signToken(claims, opts.secret);
      await store.put({
        jti: claims.jti,
        kind: claims.kind,
        expiresAt: claims.exp,
      });
      return { token, claims };
    },
    async verify(raw, now = Date.now()) {
      const v = await verifyToken(raw, opts.secret, now);
      if (!v.ok) return { ok: false, reason: v.reason };
      if (isEpochTokenStore(store)) {
        if (!epochAllows(v.claims.epoch, store.currentEpoch())) {
          return { ok: false, reason: "revoked" };
        }
      } else if (await store.isRevoked(v.claims.jti)) {
        return { ok: false, reason: "revoked" };
      }
      return { ok: true, claims: v.claims };
    },
    async decide(rawToken, method, path, now = Date.now()) {
      if (!rawToken) return { allow: false, reason: "missing_token" };
      const v = await api.verify(rawToken, now);
      if (!v.ok) return { allow: false, reason: v.reason };
      return decideFromClaims(v.claims, method, path);
    },
    async issue(req, now) {
      return issueChild(req, opts.secret, store, now);
    },
    async revoke(jti, o) {
      await store.revoke(jti, o?.cascade ?? true);
    },
  };

  const mintedRoots = await Promise.all(
    (opts.roots ?? []).map(async (root) => {
      const minted = await api.mintRoot(root);
      return { name: root.name, token: minted.token, claims: minted.claims };
    }),
  );
  roots.push(...mintedRoots);

  return api;
}
