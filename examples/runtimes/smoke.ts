/**
 * Portable smoke — Node 20+, Bun, or Deno (Web Crypto + MemoryTokenStore).
 *   node --experimental-strip-types examples/runtimes/smoke.ts
 *   bun examples/runtimes/smoke.ts
 *   deno run -A examples/runtimes/smoke.ts
 */
import { createPattern, MemoryTokenStore } from "../../src/index.js";

const pattern = await createPattern({
  secret: "smoke",
  store: new MemoryTokenStore(),
  roots: [
    {
      kind: "delegation",
      grants: [{ method: "GET", path: "/health" }],
    },
  ],
});

const token = pattern.roots[0]!.token;
const ok = await pattern.decide(token, "GET", "/health");
const denied = await pattern.decide(token, "GET", "/admin");
if (!ok.allow || denied.allow) {
  throw new Error("smoke failed");
}
console.log("ok", { jti: pattern.roots[0]!.claims.jti });
