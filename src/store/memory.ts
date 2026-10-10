import type { TokenRecord, TokenStore, TokenStoreStats } from "./types.js";

export class MemoryTokenStore implements TokenStore {
  private readonly rows = new Map<string, TokenRecord>();

  put(record: TokenRecord): Promise<void> {
    this.rows.set(record.jti, { ...record });
    return Promise.resolve();
  }

  get(jti: string): Promise<TokenRecord | null> {
    return Promise.resolve(this.rows.get(jti) ?? null);
  }

  isRevoked(jti: string): Promise<boolean> {
    const row = this.rows.get(jti);
    return Promise.resolve(Boolean(row?.revokedAt));
  }

  revoke(jti: string, cascade: boolean, now = Date.now()): Promise<void> {
    const ts = Math.floor(now / 1000);
    const mark = (id: string) => {
      const row = this.rows.get(id);
      if (row && !row.revokedAt) {
        row.revokedAt = ts;
        this.rows.set(id, row);
      }
    };
    mark(jti);
    if (!cascade) return Promise.resolve();
    const queue = [jti];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const [id, row] of this.rows) {
        if (row.parentJti === parent && !row.revokedAt) {
          mark(id);
          queue.push(id);
        }
      }
    }
    return Promise.resolve();
  }

  /** Snapshot for operator tooling (not a durable audit log). */
  stats(): TokenStoreStats {
    let revoked = 0;
    for (const row of this.rows.values()) {
      if (row.revokedAt) revoked += 1;
    }
    const total = this.rows.size;
    return { total, revoked, active: total - revoked };
  }

  list(): TokenRecord[] {
    return [...this.rows.values()].map((r) => ({ ...r }));
  }
}
