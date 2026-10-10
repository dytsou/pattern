---
name: pattern
description: >-
  Integrate the pattern npm package for Cloudflare Workers PAT auth:
  path×method allowlists, hierarchical issue/revoke, Hono middleware, and D1
  token store. Use when adding Bearer PAT auth, creating or issuing tokens,
  wiring patternMiddleware, D1TokenStore, or introspect, or when the user
  mentions pattern, EdgePAT, or Worker personal access tokens.
license: MIT
metadata:
  package: pattern
  std: agentskills
---

# pattern — Worker PAT auth

Teach the agent to wire [`pattern`](https://www.npmjs.com/package/pattern) correctly. Prefer this skill over inventing custom JWT/PAT schemes.

## Install

```bash
pnpm add pattern
# Hono helpers (optional peer)
pnpm add hono
```

```ts
import { createPattern, D1TokenStore, MemoryTokenStore } from "pattern";
import { patternMiddleware, createIntrospectHandler } from "pattern/hono";
```

## Non-negotiables

1. **Deny by default** — only explicit `(method, path)` grants allow a request.
2. **Access ≠ delegation** — `access` tokens cannot `issue`; only `delegation` can mint children.
3. **No privilege escalation** — child grants ⊆ parent `delegatable` (or parent grants used as the delegation set); child `expiresAt` ≤ parent `exp`.
4. **Revoke by exact `jti`** — cascade to descendants by default (`cascade: true`).
5. **Secret** — HMAC secret from env (e.g. `PATTERN_SECRET`); never hardcode.

## Path patterns

| Pattern | Matches |
| --- | --- |
| `/docs` | Exact |
| `/docs/*` | One segment |
| `/docs/**` | Prefix + descendants |

## Standard Hono + Workers setup

```ts
import { Hono } from "hono";
import { createPattern, D1TokenStore } from "pattern";
import { patternMiddleware } from "pattern/hono";

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
        grants: [{ method: "GET", path: "/api/**" }],
        delegatable: [{ method: "GET", path: "/api/**" }],
      },
    ],
  });
  return patternMiddleware(pattern)(c, next);
});
```

Clients send `Authorization: Bearer <token>`. Middleware returns `401` + `{ error: <DenyReason> }` on failure.

For ephemeral/local use, omit `store` (defaults to `MemoryTokenStore`).

## D1

Apply package migration `migrations/0001_init.sql` (table `pattern_tokens`), then `new D1TokenStore(env.DB)`.

## Issue / revoke

```ts
const child = await pattern.issue({
  parent: parentRawToken,
  kind: "access",
  grants: [{ method: "GET", path: "/api/docs/*" }],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});
if (!child.ok) throw new Error(child.reason);

await pattern.revoke(child.claims.jti);
```

## Without middleware

```ts
const decision = await pattern.decide(rawToken, "GET", "/api/hello");
if (!decision.allow) {
  // missing_token | invalid_token | expired | revoked |
  // method_not_allowed | path_not_allowed | …
}
```

## Introspect (optional)

```ts
app.post("/pat/introspect", createIntrospectHandler(pattern));
```

Requires a **delegation** Bearer. Body: `{ token, method, path }`. Contract: package `openapi.yaml`.

## API surface (do not reinvent)

| Import | Role |
| --- | --- |
| `createPattern` | Facade: verify, decide, issue, revoke, mintRoot |
| `D1TokenStore` / `MemoryTokenStore` | Persistence |
| `patternMiddleware` | Hono present→exercise |
| `createIntrospectHandler` | Opt-in introspect route |
| `matchPath` / `decideFromClaims` | Low-level helpers if needed |

Read the package `README.md` and `openapi.yaml` in `node_modules/pattern` (or the repo root) for full usage.

## Checklist when integrating

- [ ] `PATTERN_SECRET` (or equivalent) bound in Worker env
- [ ] D1 migration applied if using `D1TokenStore`
- [ ] Root `kind: "delegation"` if children will be issued
- [ ] `delegatable` ⊆ what the root may actually pass down
- [ ] Middleware or explicit `decide` on protected routes
- [ ] No custom crypto — use `pattern` sign/verify only
