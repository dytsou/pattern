import { describe, expect, it } from "vitest";
import { decideFromClaims, grantsAllow } from "../decide.js";
import { matchPath } from "../path.js";
import type { TokenClaims } from "../types.js";

const base = (grants: TokenClaims["grants"]): TokenClaims => ({
  jti: "t",
  kind: "access",
  grants,
  exp: Math.floor(Date.now() / 1000) + 3600,
  depth: 0,
  maxDepth: 8,
});

describe("matchPath", () => {
  it("matches exact", () => {
    expect(matchPath("/docs", "/docs")).toBe(true);
    expect(matchPath("/docs", "/docs/")).toBe(true);
  });
  it("matches single-segment star", () => {
    expect(matchPath("/docs/*", "/docs/a")).toBe(true);
    expect(matchPath("/docs/*", "/docs/a/b")).toBe(false);
  });
  it("matches recursive star", () => {
    expect(matchPath("/docs/**", "/docs/a/b")).toBe(true);
    expect(matchPath("/docs/**", "/docs")).toBe(true);
  });
});

describe("decideFromClaims", () => {
  it("allows exact grant", () => {
    const d = decideFromClaims(
      base([{ method: "GET", path: "/docs/*" }]),
      "GET",
      "/docs/x",
    );
    expect(d.allow).toBe(true);
  });
  it("denies method mismatch", () => {
    const d = decideFromClaims(
      base([{ method: "GET", path: "/docs/*" }]),
      "POST",
      "/docs/x",
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toBe("method_not_allowed");
  });
  it("denies unknown path (AE1)", () => {
    const d = decideFromClaims(
      base([{ method: "GET", path: "/docs/*" }]),
      "GET",
      "/admin",
    );
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.reason).toBe("path_not_allowed");
  });
  it("grantsAllow joint check", () => {
    expect(grantsAllow([{ method: "GET", path: "/a" }], "GET", "/a")).toBe(
      true,
    );
    expect(grantsAllow([{ method: "GET", path: "/a" }], "POST", "/a")).toBe(
      false,
    );
  });
});
