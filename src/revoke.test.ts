import { describe, expect, it } from "vitest";
import { createPattern } from "./pattern.js";
import { MemoryTokenStore } from "./store-memory.js";

describe("revoke", () => {
  it("revoked jti fails immediately (AE4)", async () => {
    const p = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const root = p.roots[0]!;
    const child = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/x" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect((await p.decide(child.token, "GET", "/x")).allow).toBe(true);
    await p.revoke(child.claims.jti, { cascade: false });
    const d = await p.decide(child.token, "GET", "/x");
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toBe("revoked");
  });

  it("parent revoke cascades", async () => {
    const p = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
          maxDepth: 5,
        },
      ],
    });
    const root = p.roots[0]!;
    const mid = await p.issue({
      parent: root.token,
      kind: "delegation",
      grants: [{ method: "GET", path: "/api/**" }],
      delegatable: [{ method: "GET", path: "/api/**" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(mid.ok).toBe(true);
    if (!mid.ok) return;
    const leaf = await p.issue({
      parent: mid.token,
      grants: [{ method: "GET", path: "/api/docs" }],
      expiresAt: root.claims.exp - 2,
    });
    expect(leaf.ok).toBe(true);
    if (!leaf.ok) return;
    await p.revoke(mid.claims.jti, { cascade: true });
    expect((await p.decide(leaf.token, "GET", "/api/docs")).allow).toBe(false);
  });

  it("MemoryTokenStore.stats counts revoked rows", async () => {
    const store = new MemoryTokenStore();
    const p = await createPattern({
      secret: "s",
      store,
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const root = p.roots[0]!;
    const child = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/x" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(store.stats()).toEqual({ total: 2, revoked: 0, active: 2 });
    await p.revoke(child.claims.jti, { cascade: false });
    expect(store.stats()).toEqual({ total: 2, revoked: 1, active: 1 });
    expect(
      store.list().some((r) => r.jti === child.claims.jti && r.revokedAt),
    ).toBe(true);
  });
});
