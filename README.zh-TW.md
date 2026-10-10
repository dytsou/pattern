# pattern（繁體中文概覽）

Cloudflare Workers 用的 PAT 授權函式庫：**路徑 × HTTP 方法** allowlist、階層式簽發、精確 `jti` 撤銷（可選 epoch 全量世代）。

## 安裝

```bash
pnpm add @dytsou/pattern 
pnpm add hono
```

```ts
import { createPattern, D1TokenStore, MemoryTokenStore } from "@dytsou/pattern";
import { patternMiddleware, createIntrospectHandler } from "@dytsou/pattern/hono";
```

## 核心概念


| 概念              | 說明                                    |
| --------------- | ------------------------------------- |
| **Grant**       | 一組允許的 `(method, path-pattern)`        |
| **Access**      | 只能呼叫 API，不能簽發子 token                  |
| **Delegation**  | 可呼叫 API，並依 `delegatable` 簽發更窄的子 token |
| **Attenuation** | 子 token 不能比父 token 權限更大或活得更久          |
| **Revoke**      | 預設精確 `jti`；cascade 會連子孫一起撤銷           |


路徑：`/docs` 精確、`/docs/*` 單段、`/docs/**` 前綴含子孫。

## 快速開始

見英文 README 的 Hono on Workers 範例。重點：

1. `createPattern({ secret, store, roots })`
2. `patternMiddleware(pattern)` 掛上 Hono
3. 用戶端帶 `Authorization: Bearer <token>`
4. D1：套用 `migrations/0001_init.sql`，使用 `D1TokenStore`

## 撤銷模式

- **預設**：`MemoryTokenStore` / `D1TokenStore` — 精確 jti + cascade
- **精簡**：`EpochTokenStore` — `revoke` 推進世代，舊 token 全部失效；自行持久化 `store.state`（例如 KV）

## 屬性測試語料

```ts
import { runPropertyCorpus } from "@dytsou/pattern/properties";
await runPropertyCorpus();
```

## 範例與 Agent Skill

- Workers：`examples/hono-worker`
- Node / Bun / Deno 煙測：`examples/runtimes/smoke.ts`
- Agent Skill：`.agents/skills/pattern/`（詳見 `AGENTS.md`）

## 授權

見 [LICENSE](LICENSE)。