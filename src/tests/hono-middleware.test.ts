import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createPattern } from "../pattern.js";
import { patternMiddleware } from "../hono/middleware.js";

describe("hono middleware", () => {
  it("allows granted route and denies others", async () => {
    const pattern = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "access",
          grants: [{ method: "GET", path: "/docs/*" }],
        },
      ],
    });
    const app = new Hono();
    app.use("*", patternMiddleware(pattern));
    app.get("/docs/a", (c) => c.text("ok"));
    app.get("/admin", (c) => c.text("nope"));

    const token = pattern.roots[0]!.token;
    const ok = await app.request("http://localhost/docs/a", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);

    const deny = await app.request("http://localhost/admin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deny.status).toBe(401);

    const missing = await app.request("http://localhost/docs/a");
    expect(missing.status).toBe(401);
  });
});
