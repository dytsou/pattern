# pattern

Personal Access Token (PAT) auth for Cloudflare Workers: **path × method** allowlists, hierarchical issuance, and exact `jti` revocation.

## Install

```bash
pnpm add @dytsou/pattern
pnpm add hono
```

Imports:

```ts
import { createPattern, D1TokenStore, MemoryTokenStore } from "@dytsou/pattern";
import { patternMiddleware, createIntrospectHandler } from "@dytsou/pattern/hono";
```

## Quick start (Hono on Workers)

```ts
import { Hono } from "hono";
import { createPattern, D1TokenStore } from "@dytsou/pattern";
import { patternMiddleware } from "@dytsou/pattern/hono";

type Env = { PATTERN_SECRET: string; DB: D1Database };

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const pattern = await createPattern({
    secret: c.env.PATTERN_SECRET,
    store: new D1TokenStore(c.env.DB),
    roots: [
      {
        name: "root",
        kind: "delegation",
        grants: [
          { method: "GET", path: "/docs/**" },
          { method: "GET", path: "/api/**" },
        ],
        // what this token may pass to children
        delegatable: [{ method: "GET", path: "/docs/**" }],
      },
    ],
  });

  // Log once at boot if you need the minted root token:
  // console.log(pattern.roots[0]?.token);

  return patternMiddleware(pattern)(c, next);
});

app.get("/docs/hello", (c) => c.text("hello"));

export default app;
```

Call your API with:

```http
Authorization: Bearer <token>
```

Without a matching grant (or with a missing/invalid/revoked token), the middleware responds `401` and `{ "error": "<reason>" }`.

## Concepts

| Idea | Meaning |
| --- | --- |
| **Grant** | One allowed `(method, path-pattern)` pair |
| **Access token** | Can call APIs that match `grants`; cannot issue children |
| **Delegation token** | Can call APIs and issue narrower children via `delegatable` |
| **Attenuation** | Children cannot gain methods/paths or a longer expiry than the parent |
| **Revoke** | Exact `jti`; cascade revokes descendants by default |

Path patterns:

| Pattern | Matches |
| --- | --- |
| `/docs` | Exact path |
| `/docs/*` | One segment (`/docs/a`, not `/docs/a/b`) |
| `/docs/**` | Prefix and all descendants |

## Create a Pattern instance

```ts
const pattern = await createPattern({
  secret: env.PATTERN_SECRET, // long random string
  store: new MemoryTokenStore(), // default if omitted
  roots: [
    /* optional StaticRoot[] minted at create time */
  ],
});
```

`pattern` exposes:

| Method | Use |
| --- | --- |
| `verify(raw)` | Validate signature, expiry, revocation |
| `decide(raw, method, path)` | Verify + allowlist check |
| `issue({ parent, grants, expiresAt, ... })` | Mint a child under a parent token |
| `revoke(jti, { cascade? })` | Revoke (cascade defaults to `true`) |
| `mintRoot(root)` | Mint another root after create |
| `roots` | Roots minted from `createPattern({ roots })` |

## Issue a child token

Only a **delegation** parent can issue. Child grants must be covered by the parent's `delegatable` (or `grants` when used as the delegation set), and `expiresAt` must be ≤ parent `exp`.

```ts
const child = await pattern.issue({
  parent: rootToken, // raw Bearer token string
  kind: "access", // or "delegation"
  grants: [{ method: "GET", path: "/docs/*" }],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});

if (!child.ok) {
  // child.reason, optional child.diff (excessGrants, expiryTooLong, …)
  throw new Error(child.reason);
}

// child.token → give to the client
// child.claims.jti → keep if you need to revoke later
```

## Revoke

```ts
await pattern.revoke(child.claims.jti);
// await pattern.revoke(jti, { cascade: false }); // this jti only
```

Later requests with that token fail with `revoked`.

Exact `jti` mesh (`MemoryTokenStore` / `D1TokenStore`) is the default. For ultra-minimal deploys, `EpochTokenStore` stamps `claims.epoch` and treats any `revoke` as a **global generation bump** (all prior tokens die). Persist `store.state` yourself if you need durability across isolates.

```ts
import { createPattern, EpochTokenStore } from "@dytsou/pattern";

const store = new EpochTokenStore(); // or new EpochTokenStore({ epoch: n }) from KV
const pattern = await createPattern({ secret, store, roots: [/* … */] });
await pattern.revoke("any-jti"); // bumps epoch — cascade is irrelevant
```

`MemoryTokenStore` also exposes `stats()` / `list()` for light operator visibility (counts and in-memory rows — not an admin product).

## Persist with D1

1. Apply [`migrations/0001_init.sql`](migrations/0001_init.sql) to your D1 database.
2. Pass `D1TokenStore`:

```ts
import { createPattern, D1TokenStore } from "@dytsou/pattern";

const pattern = await createPattern({
  secret: env.PATTERN_SECRET,
  store: new D1TokenStore(env.DB),
  roots: [
    /* ... */
  ],
});
```

For local tests or ephemeral Workers, omit `store` (uses `MemoryTokenStore`).

## Without middleware

Pass the raw token string (the part after `Bearer `):

```ts
const decision = await pattern.decide(rawToken, "GET", "/docs/hello");

if (!decision.allow) {
  // decision.reason: missing_token | invalid_token | expired | revoked |
  //                   method_not_allowed | path_not_allowed | …
}
```

## Optional introspect endpoint

Mount only behind your own auth expectations (handler requires a **delegation** Bearer):

```ts
import { createIntrospectHandler } from "@dytsou/pattern/hono";

app.post("/pat/introspect", createIntrospectHandler(pattern));
```

Request body: `{ "token", "method", "path" }`. See [`openapi.yaml`](openapi.yaml) for the HTTP shape.

## Property corpus

Shipped invariants (peer `fast-check`):

```ts
import { runPropertyCorpus } from "@dytsou/pattern/properties";

await runPropertyCorpus(); // or call propDenyByDefault, propRevokePropagates, …
```

## Examples

| Path | Runtime |
| --- | --- |
| [`examples/hono-worker`](examples/hono-worker) | Cloudflare Workers + Hono + D1 |
| [`examples/runtimes/smoke.ts`](examples/runtimes/smoke.ts) | Node 20+ / Bun / Deno (Web Crypto) |

Traditional Chinese overview: [`README.zh-TW.md`](README.zh-TW.md) (English remains canonical).

## AI agents (Cursor, Claude Code, Codex, OpenCode, Kimi, …)

This repo ships an [Agent Skill](https://agentskills.io) so coding agents can wire `pattern` correctly:

| Layout | Agents |
| --- | --- |
| [`.agents/skills/pattern/`](.agents/skills/pattern/SKILL.md) | Cursor, Codex, OpenCode, Kimi, AGI, other agentskills clients |
| `.claude/skills/pattern/` | Claude Code (symlink) |
| `.cursor/skills/`, `.codex/skills/`, `.opencode/skills/` | Extra discovery paths (symlinks) |

Project pointer: [`AGENTS.md`](AGENTS.md). The published package includes `.agents/` + `AGENTS.md` — copy `node_modules/@dytsou/pattern/.agents/skills/pattern` into your app’s `.agents/skills/pattern` if you consume via npm.

## License

See [LICENSE](LICENSE) for details.