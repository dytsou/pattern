/**
 * Minimal Worker sketch — copy into a wrangler project.
 * Dependencies: pattern, hono
 */
import { Hono } from "hono";
import { createPattern, D1TokenStore } from "../../src/index.js";
import { createIntrospectHandler, patternMiddleware } from "../../src/hono/index.js";

type Env = {
  PATTERN_SECRET: string;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Env }>();

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
  // @ts-expect-error demo sketch
  c.set("pattern", pattern);
  return patternMiddleware(pattern)(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));
app.post("/pat/introspect", async (c) => {
  // @ts-expect-error demo sketch
  const pattern = c.get("pattern");
  return createIntrospectHandler(pattern)(c);
});

export default app;
