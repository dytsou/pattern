import { describe, expect, it } from "vitest";
import { createPattern } from "../pattern.js";

describe("issue", () => {
  it("access token cannot issue (AE2)", async () => {
    const p = await createPattern({
      secret: "s",
      roots: [
        {
          name: "root",
          kind: "delegation",
          grants: [{ method: "GET", path: "/docs/**" }],
          maxDepth: 4,
        },
      ],
    });
    const root = p.roots[0]!;
    const child = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/docs/*" }],
      kind: "access",
      expiresAt: root.claims.exp - 10,
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    const again = await p.issue({
      parent: child.token,
      grants: [{ method: "GET", path: "/docs/a" }],
      expiresAt: root.claims.exp - 20,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("not_delegatable");
  });

  it("rejects over-scope with diff", async () => {
    const p = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/docs/**" }],
          delegatable: [{ method: "GET", path: "/docs/**" }],
        },
      ],
    });
    const root = p.roots[0]!;
    const r = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/admin" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("privilege_escalation");
      expect(r.diff?.excessGrants.length).toBe(1);
    }
  });

  it("rejects child exp > parent (AE3)", async () => {
    const p = await createPattern({
      secret: "s",
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    });
    const root = p.roots[0]!;
    const r = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/a" }],
      expiresAt: root.claims.exp + 100,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expiry_exceeds_parent");
  });
});
