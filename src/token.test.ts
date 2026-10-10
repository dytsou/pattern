import { describe, expect, it } from "vitest";
import { decideFromClaims } from "./decide.js";
import { signToken, verifyToken } from "./token.js";
import type { TokenClaims } from "./types.js";

const secret = "test-secret";

describe("token sign/verify", () => {
  it("round-trips", async () => {
    const claims: TokenClaims = {
      jti: "abc",
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      exp: Math.floor(Date.now() / 1000) + 60,
      depth: 0,
      maxDepth: 3,
    };
    const raw = await signToken(claims, secret);
    const v = await verifyToken(raw, secret);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.claims.jti).toBe("abc");
  });

  it("rejects tamper", async () => {
    const claims: TokenClaims = {
      jti: "abc",
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      exp: Math.floor(Date.now() / 1000) + 60,
      depth: 0,
      maxDepth: 3,
    };
    const raw = await signToken(claims, secret);
    const bad = raw.slice(0, -2) + "zz";
    const v = await verifyToken(bad, secret);
    expect(v.ok).toBe(false);
  });

  it("rejects expired", async () => {
    const claims: TokenClaims = {
      jti: "abc",
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      exp: Math.floor(Date.now() / 1000) - 10,
      depth: 0,
      maxDepth: 3,
    };
    const raw = await signToken(claims, secret);
    const v = await verifyToken(raw, secret);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("expired");
  });

  it("feeds decide", async () => {
    const claims: TokenClaims = {
      jti: "abc",
      kind: "access",
      grants: [{ method: "GET", path: "/x" }],
      exp: Math.floor(Date.now() / 1000) + 60,
      depth: 0,
      maxDepth: 3,
    };
    const raw = await signToken(claims, secret);
    const v = await verifyToken(raw, secret);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(decideFromClaims(v.claims, "GET", "/x").allow).toBe(true);
    }
  });
});
