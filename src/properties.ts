/**
 * Publishable property-test corpus — the trust surface for pattern invariants.
 * Requires peer `fast-check` (optional). Import via `@dytsou/pattern/properties`.
 */
import fc from "fast-check";
import { grantsAllow } from "./decide.js";
import { grantCoveredBy, intersectGrants } from "./intersect.js";
import { createPattern } from "./pattern.js";
import type { Grant, HttpMethod } from "./types.js";

const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE"];

const grantArb: fc.Arbitrary<Grant> = fc.record({
  method: fc.constantFrom(...methods),
  path: fc.constantFrom("/a", "/a/*", "/b/**", "/x"),
});

/** Empty grants never allow any request. */
export function propDenyByDefault(numRuns = 100): void {
  fc.assert(
    fc.property(
      fc.constantFrom(...methods),
      fc.string({ minLength: 1, maxLength: 20 }),
      (m, path) => {
        const p = path.startsWith("/") ? path : `/${path}`;
        return grantsAllow([], m, p) === false;
      },
    ),
    { numRuns },
  );
}

/** Successful intersect never widens beyond the parent grant set. */
export function propNoEscalation(numRuns = 100): void {
  fc.assert(
    fc.property(
      fc.array(grantArb, { maxLength: 5 }),
      fc.array(grantArb, { maxLength: 5 }),
      (parent, req) => {
        const r = intersectGrants(parent, req);
        if (!r.ok) return true;
        return r.grants.every((g) => grantCoveredBy(g, parent));
      },
    ),
    { numRuns },
  );
}

/** Access tokens cannot issue; children cannot outlive parents. */
export async function propAccessNotDelegationAndChildExpiry(
  numRuns = 20,
): Promise<void> {
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
      if (!access.ok) return false;
      const bad = await p.issue({
        parent: access.token,
        grants: [{ method: "GET", path: "/z" }],
        expiresAt: now + Math.floor(ttl / 3),
      });
      if (bad.ok) return false;
      const tooLong = await p.issue({
        parent: root.token,
        grants: [{ method: "GET", path: "/z" }],
        expiresAt: root.claims.exp + 1,
      });
      return !tooLong.ok;
    }),
    { numRuns },
  );
}

/**
 * Revoking a parent jti with cascade denies all recorded descendants.
 * Uses MemoryTokenStore (default) for random small trees.
 */
export async function propRevokePropagates(numRuns = 15): Promise<void> {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 3 }), async (depth) => {
      const now = Math.floor(Date.now() / 1000);
      const p = await createPattern({
        secret: "prop-revoke",
        roots: [
          {
            kind: "delegation",
            grants: [{ method: "GET", path: "/**" }],
            delegatable: [{ method: "GET", path: "/**" }],
            exp: now + 3600,
            maxDepth: 8,
          },
        ],
      });
      const root = p.roots[0]!;
      let parentToken = root.token;
      let parentExp = root.claims.exp;
      const chain: { token: string; jti: string }[] = [];

      for (let i = 0; i < depth; i++) {
        const child = await p.issue({
          parent: parentToken,
          kind: "delegation",
          grants: [{ method: "GET", path: "/api/**" }],
          delegatable: [{ method: "GET", path: "/api/**" }],
          expiresAt: parentExp - 1,
        });
        if (!child.ok) return false;
        chain.push({ token: child.token, jti: child.claims.jti });
        parentToken = child.token;
        parentExp = child.claims.exp;
      }

      const leaf = await p.issue({
        parent: parentToken,
        kind: "access",
        grants: [{ method: "GET", path: "/api/x" }],
        expiresAt: parentExp - 1,
      });
      if (!leaf.ok) return false;

      const before = await p.decide(leaf.token, "GET", "/api/x");
      if (!before.allow) return false;

      // Revoke the first issued mid-node (or the only mid when depth=1).
      const cut = chain[0]!;
      await p.revoke(cut.jti, { cascade: true });

      for (const node of chain) {
        const d = await p.decide(node.token, "GET", "/api/x");
        if (d.allow) return false;
      }
      const after = await p.decide(leaf.token, "GET", "/api/x");
      return !after.allow;
    }),
    { numRuns },
  );
}

/** Run the full shipped corpus (sync + async properties). */
export async function runPropertyCorpus(opts?: {
  numRuns?: number;
}): Promise<void> {
  const n = opts?.numRuns ?? 20;
  propDenyByDefault(n);
  propNoEscalation(n);
  await propAccessNotDelegationAndChildExpiry(n);
  await propRevokePropagates(Math.min(n, 15));
}
