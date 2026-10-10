export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type TokenKind = "access" | "delegation";

/** One allowlist grant — joint (method, path-pattern). */
export interface Grant {
  method: HttpMethod;
  path: string;
}

export interface TokenClaims {
  jti: string;
  kind: TokenKind;
  grants: Grant[];
  /** Paths/methods this delegation token may pass to children. Access tokens omit or empty. */
  delegatable?: Grant[];
  exp: number; // unix seconds
  depth: number;
  maxDepth: number;
  parentJti?: string;
  name?: string;
}

export type Decision =
  | { allow: true; claims: TokenClaims }
  | { allow: false; reason: DenyReason };

export type DenyReason =
  | "missing_token"
  | "invalid_token"
  | "expired"
  | "revoked"
  | "method_not_allowed"
  | "path_not_allowed"
  | "not_delegatable";

export interface AttenuationDiff {
  excessGrants: Grant[];
  expiryTooLong: boolean;
  depthExceeded: boolean;
}

export interface IssueRequest {
  parent: string; // raw parent token
  name?: string;
  grants: Grant[];
  delegatable?: Grant[];
  kind?: TokenKind;
  expiresAt: number; // unix seconds
  maxDepth?: number;
}

export type IssueResult =
  | { ok: true; token: string; claims: TokenClaims }
  | { ok: false; reason: string; diff?: AttenuationDiff };
