import { describe, expect, it } from "vitest";
import { createPattern } from "../pattern.js";
import { EpochTokenStore } from "../store/index.js";
import { signToken } from "../token.js";
import type { TokenClaims } from "../types.js";

describe("EpochTokenStore", () => {
  it("coerces partial state so epoch is never undefined", () => {
    const store = new EpochTokenStore({} as { epoch: number });
    expect(store.currentEpoch()).toBe(0);
    expect(store.state.epoch).toBe(0);
  });

  it("denies tokens missing a finite claims.epoch", async () => {
    const store = new EpochTokenStore();
    const p = await createPattern({
      secret: "epoch-missing",
      store,
      roots: [
        {
          kind: "delegation",
          grants: [{ method: "GET", path: "/**" }],
        },
      ],
    });
    const claims: TokenClaims = {
      jti: "no-epoch",
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      exp: Math.floor(Date.now() / 1000) + 3600,
      depth: 0,
      maxDepth: 8,
      // epoch omitted
    };
    const token = await signToken(claims, "epoch-missing");
    const d = await p.decide(token, "GET", "/x");
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toBe("revoked");
  });

  it("rejects issue when parent epoch is stale after bump", async () => {
    const store = new EpochTokenStore();
    const p = await createPattern({
      secret: "epoch-issue",
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
    await p.revoke(root.claims.jti);
    const child = await p.issue({
      parent: root.token,
      grants: [{ method: "GET", path: "/x" }],
      expiresAt: root.claims.exp - 1,
    });
    expect(child.ok).toBe(false);
    if (!child.ok) expect(child.reason).toBe("revoked");
  });

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
