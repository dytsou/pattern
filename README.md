# pattern

Lightweight **Personal Access Token** auth for Cloudflare Workers: path × method allowlists, hierarchical issuance (access ≠ delegation), and exact `jti` revocation.

## Ten-minute Hono path

```bash
pnpm add pattern hono
```

```ts
import { Hono } from "hono";
import { createPattern } from "pattern";
import { patternMiddleware } from "pattern/hono";

type Env = { PATTERN_SECRET: string; DB: D1Database };

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const pattern = await createPattern({
    secret: c.env.PATTERN_SECRET,
    // production: store: new D1TokenStore(c.env.DB),
    roots: [
      {
        name: "root",
        kind: "delegation",
        grants: [
          { method: "GET", path: "/docs/**" },
          { method: "GET", path: "/api/**" },
        ],
        delegatable: [{ method: "GET", path: "/docs/**" }],
      },
    ],
  });
  c.set("pattern", pattern);
  return patternMiddleware(pattern)(c, next);
});

app.get("/docs/hello", (c) => c.text("hello"));

export default app;
```

1. Put a long random string in `PATTERN_SECRET`.
2. Log `pattern.roots[0].token` once at boot (or mint via `pattern.mintRoot`) and call with `Authorization: Bearer <token>`.
3. Issue a child:

```ts
const child = await pattern.issue({
  parent: rootToken,
  grants: [{ method: "GET", path: "/docs/*" }],
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});
```

4. Revoke: `await pattern.revoke(child.claims.jti)` — subsequent requests fail with `revoked`.

Optional introspect: `app.post("/pat/introspect", createIntrospectHandler(pattern))` (auth-gated; mount only when needed).

## Security principles

- Deny by default (allowlist only)
- Access ≠ delegation
- No privilege escalation on `issue`
- Child expiry ≤ parent expiry
- Exact `jti` revoke with parent→child cascade

## D1

Apply `migrations/0001_init.sql`, then:

```ts
import { createPattern, D1TokenStore } from "pattern";

const pattern = await createPattern({
  secret: env.PATTERN_SECRET,
  store: new D1TokenStore(env.DB),
  roots: [/* ... */],
});
```

## API page

OpenAPI contract: [`openapi.yaml`](openapi.yaml).

```bash
pnpm run api:lint    # Redocly lint
pnpm run api:build   # Swagger UI → dist/api/
pnpm run api:preview # serve dist/api on :4173
```

CI also runs Biome (`format:check`, `lint`), tests, build, and API docs generation.
Dependabot (weekly) runs on this repository.

## License

MIT
