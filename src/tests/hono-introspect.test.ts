import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createPattern } from "../pattern.js";
import { createIntrospectHandler } from "../hono/introspect.js";

describe("introspect", () => {
  it("explains deny reason for subject token when caller is delegation", async () => {
    const pattern = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/docs/**" }],
          delegatable: [{ method: "GET", path: "/docs/**" }],
        },
      ],
    });
    const root = pattern.roots[0]!;
    const access = await pattern.issue({
      parent: root.token,
      kind: "access",
      grants: [{ method: "GET", path: "/docs/*" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(access.ok).toBe(true);
    if (!access.ok) return;

    const app = new Hono();
    app.post("/pat/introspect", createIntrospectHandler(pattern));

    const res = await app.request("http://localhost/pat/introspect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${root.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: access.token,
        method: "GET",
        path: "/admin",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      reason?: string;
    };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("path_not_allowed");
  });

  it("rejects missing caller bearer", async () => {
    const pattern = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const app = new Hono();
    app.post("/pat/introspect", createIntrospectHandler(pattern));
    const res = await app.request("http://localhost/pat/introspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "x",
        method: "GET",
        path: "/",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects access-token caller", async () => {
    const pattern = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
          delegatable: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const root = pattern.roots[0]!;
    const access = await pattern.issue({
      parent: root.token,
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(access.ok).toBe(true);
    if (!access.ok) return;

    const app = new Hono();
    app.post("/pat/introspect", createIntrospectHandler(pattern));
    const res = await app.request("http://localhost/pat/introspect", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: access.token,
        method: "GET",
        path: "/x",
      }),
    });
    expect(res.status).toBe(403);
  });
});
