import { matchPath } from "./path.js";
import type { Decision, Grant, HttpMethod, TokenClaims } from "./types.js";

export function grantsAllow(
  grants: Grant[],
  method: HttpMethod,
  path: string,
): boolean {
  return grants.some(
    (g) => g.method === method && matchPath(g.path, path),
  );
}

/** Joint allowlist decision from verified claims. */
export function decideFromClaims(
  claims: TokenClaims,
  method: HttpMethod,
  path: string,
): Decision {
  if (!grantsAllow(claims.grants, method, path)) {
    const methodOk = claims.grants.some((g) => matchPath(g.path, path));
    return {
      allow: false,
      reason: methodOk ? "method_not_allowed" : "path_not_allowed",
    };
  }
  return { allow: true, claims };
}
