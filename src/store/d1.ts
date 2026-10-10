import type { TokenRecord, TokenStore } from "./types.js";

/** Minimal D1 surface used by the adapter. */
export interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
}

type Row = {
  jti: string;
  parent_jti: string | null;
  kind: string;
  expires_at: number;
  revoked_at: number | null;
};

export class D1TokenStore implements TokenStore {
  constructor(private readonly db: D1Like) {}

  async put(record: TokenRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO pattern_tokens (jti, parent_jti, kind, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(jti) DO UPDATE SET
           parent_jti=excluded.parent_jti,
           kind=excluded.kind,
           expires_at=excluded.expires_at,
           revoked_at=excluded.revoked_at`,
      )
      .bind(
        record.jti,
        record.parentJti ?? null,
        record.kind,
        record.expiresAt,
        record.revokedAt ?? null,
      )
      .run();
  }

  async get(jti: string): Promise<TokenRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT jti, parent_jti, kind, expires_at, revoked_at FROM pattern_tokens WHERE jti = ?`,
      )
      .bind(jti)
      .first<Row>();
    if (!row) return null;
    return {
      jti: row.jti,
      parentJti: row.parent_jti ?? undefined,
      kind: row.kind as TokenRecord["kind"],
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at ?? undefined,
    };
  }

  async isRevoked(jti: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT revoked_at FROM pattern_tokens WHERE jti = ?`)
      .bind(jti)
      .first<{ revoked_at: number | null }>();
    return Boolean(row?.revoked_at);
  }

  async revoke(jti: string, cascade: boolean, now = Date.now()): Promise<void> {
    const ts = Math.floor(now / 1000);
    await this.db
      .prepare(
        `UPDATE pattern_tokens SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL`,
      )
      .bind(ts, jti)
      .run();
    if (!cascade) return;
    // Level-by-level cascade via parent_jti — small trees expected for v1
    await this.revokeDescendants(ts, [jti]);
  }

  private async revokeDescendants(
    ts: number,
    parents: string[],
  ): Promise<void> {
    if (!parents.length) return;
    const placeholders = parents.map(() => "?").join(",");
    const { results } = await this.db
      .prepare(
        `SELECT jti FROM pattern_tokens WHERE parent_jti IN (${placeholders}) AND revoked_at IS NULL`,
      )
      .bind(...parents)
      .all<{ jti: string }>();
    const children = results.map((r) => r.jti);
    if (!children.length) return;
    const cPlace = children.map(() => "?").join(",");
    await this.db
      .prepare(
        `UPDATE pattern_tokens SET revoked_at = ? WHERE jti IN (${cPlace})`,
      )
      .bind(ts, ...children)
      .run();
    await this.revokeDescendants(ts, children);
  }
}
