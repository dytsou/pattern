/**
 * Minimal Worker example — copy into a wrangler project.
 * Dependencies: @dytsou/pattern, hono
 */
import { Hono } from "hono";
import {
  createPattern,
  D1TokenStore,
  type Pattern,
} from "../../src/index.js";
import {
  createIntrospectHandler,
  patternMiddleware,
} from "../../src/hono/index.js";

type Env = {
  PATTERN_SECRET: string;
  DB: D1Database;
};

type Variables = {
  pattern: Pattern;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const pattern = await createPattern({
    secret: c.env.PATTERN_SECRET,
    store: new D1TokenStore(c.env.DB),
    roots: [
      {
        name: "root",
        kind: "delegation",
        grants: [{ method: "GET", path: "/**" }],
        delegatable: [{ method: "GET", path: "/**" }],
      },
    ],
  });
  c.set("pattern", pattern);
  return patternMiddleware(pattern)(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));

app.post("/pat/introspect", (c) => {
  const pattern = c.get("pattern");
  return createIntrospectHandler(pattern)(c);
});

export default app;
