import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { grantsAllow } from "./decide.js";
import { intersectGrants } from "./intersect.js";
import { createPattern } from "./pattern.js";
import type { Grant, HttpMethod } from "./types.js";

const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE"];

const grantArb: fc.Arbitrary<Grant> = fc.record({
  method: fc.constantFrom(...methods),
  path: fc.constantFrom("/a", "/a/*", "/b/**", "/x"),
});

describe("properties", () => {
  it("prop_denyByDefault: empty grants never allow", () => {
    fc.assert(
      fc.property(fc.constantFrom(...methods), fc.string({ minLength: 1, maxLength: 20 }), (m, path) => {
        expect(grantsAllow([], m, path.startsWith("/") ? path : "/" + path)).toBe(false);
      }),
    );
  });

  it("prop_noEscalation: intersect never widens", () => {
    fc.assert(
      fc.property(fc.array(grantArb, { maxLength: 5 }), fc.array(grantArb, { maxLength: 5 }), (parent, req) => {
        const r = intersectGrants(parent, req);
        if (r.ok) {
          for (const g of r.grants) {
            expect(parent.some((p) => p.method === g.method)).toBe(true);
          }
        }
      }),
    );
  });

  it("prop_accessNotDelegation + childExpiryLEParent", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 60, max: 10_000 }), async (ttl) => {
        const now = Math.floor(Date.now() / 1000);
        const p = await createPattern({
          secret: "prop",
          roots: [
            {
              kind: "delegation",
              grants: [{ method: "GET", path: "/**" }],
              exp: now + ttl,
              maxDepth: 3,
            },
          ],
        });
        const root = p.roots[0]!;
        const access = await p.issue({
          parent: root.token,
          kind: "access",
          grants: [{ method: "GET", path: "/z" }],
          expiresAt: now + Math.floor(ttl / 2),
        });
        expect(access.ok).toBe(true);
        if (!access.ok) return;
        const bad = await p.issue({
          parent: access.token,
          grants: [{ method: "GET", path: "/z" }],
          expiresAt: now + Math.floor(ttl / 3),
        });
        expect(bad.ok).toBe(false);

        const tooLong = await p.issue({
          parent: root.token,
          grants: [{ method: "GET", path: "/z" }],
          expiresAt: root.claims.exp + 1,
        });
        expect(tooLong.ok).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
