import { describe, expect, it } from "vitest";
import { createPattern } from "../pattern.js";
import { EpochTokenStore } from "../store/index.js";

describe("EpochTokenStore", () => {
  it("bump on revoke invalidates all prior tokens", async () => {
    const store = new EpochTokenStore();
    const p = await createPattern({
      secret: "epoch",
      store,
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
          delegatable: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const root = p.roots[0]!;
    expect(root.claims.epoch).toBe(0);
    const child = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/x" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.claims.epoch).toBe(0);
    expect((await p.decide(child.token, "GET", "/x")).allow).toBe(true);

    await p.revoke(child.claims.jti);
    expect(store.currentEpoch()).toBe(1);
    expect((await p.decide(child.token, "GET", "/x")).allow).toBe(false);
    expect((await p.decide(root.token, "GET", "/x")).allow).toBe(false);

    const again = await p.mintRoot({
      kind: "delegation",
      grants: [{ method: "GET", path: "/**" }],
    });
    expect(again.claims.epoch).toBe(1);
    expect((await p.decide(again.token, "GET", "/x")).allow).toBe(true);
  });
});
