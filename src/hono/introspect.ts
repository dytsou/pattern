import type { Context } from "hono";
import { decideFromClaims } from "../decide.js";
import type { Pattern } from "../pattern.js";
import type { HttpMethod } from "../types.js";
import { bearer } from "./middleware.js";

/**
 * Opt-in introspect handler. Caller must already be authenticated as a
 * delegation/root principal (checked via Authorization Bearer).
 */
export function createIntrospectHandler(pattern: Pattern) {
  return async (c: Context) => {
    const presented = bearer(c.req.header("Authorization"));
    if (!presented) return c.json({ error: "missing_token" }, 401);
    const caller = await pattern.verify(presented);
    if (!caller.ok) return c.json({ error: caller.reason }, 401);
    if (caller.claims.kind !== "delegation") {
      return c.json({ error: "not_delegatable" }, 403);
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      token?: string;
      method?: string;
      path?: string;
    };
    if (!body.token || !body.method || !body.path) {
      return c.json({ error: "token, method, path required" }, 400);
    }
    const subject = await pattern.verify(body.token);
    if (!subject.ok) {
      return c.json({ ok: false, reason: subject.reason }, 200);
    }
    const decision = decideFromClaims(
      subject.claims,
      body.method.toUpperCase() as HttpMethod,
      body.path,
    );
    return c.json({
      ok: decision.allow,
      reason: decision.allow ? undefined : decision.reason,
      claims: {
        jti: subject.claims.jti,
        kind: subject.claims.kind,
        grants: subject.claims.grants,
        exp: subject.claims.exp,
        depth: subject.claims.depth,
        parentJti: subject.claims.parentJti,
      },
    });
  };
}
