import type { Context, MiddlewareHandler, Next } from "hono";
import type { Pattern } from "../pattern.js";
import type { Decision, HttpMethod } from "../types.js";

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1] ?? null;
}

/** present → exercise in one middleware for the happy path. */
export function patternMiddleware(pattern: Pattern): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const token = bearer(c.req.header("Authorization"));
    const method = c.req.method.toUpperCase() as HttpMethod;
    const path = new URL(c.req.url).pathname;
    const decision = await pattern.decide(token, method, path);
    c.set("patternDecision", decision);
    if (!decision.allow) {
      return c.json({ error: decision.reason }, 401);
    }
    await next();
  };
}

export async function present(
  pattern: Pattern,
  authorizationHeader: string | undefined,
) {
  const token = bearer(authorizationHeader);
  if (!token) return { ok: false as const, reason: "missing_token" as const };
  return pattern.verify(token);
}

export async function exercise(
  pattern: Pattern,
  rawToken: string,
  method: HttpMethod,
  path: string,
): Promise<Decision> {
  return pattern.decide(rawToken, method, path);
}
