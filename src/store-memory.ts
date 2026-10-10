import type { TokenRecord, TokenStore } from "./store.js";

export class MemoryTokenStore implements TokenStore {
  private rows = new Map<string, TokenRecord>();

  async put(record: TokenRecord): Promise<void> {
    this.rows.set(record.jti, { ...record });
  }

  async get(jti: string): Promise<TokenRecord | null> {
    return this.rows.get(jti) ?? null;
  }

  async isRevoked(jti: string): Promise<boolean> {
    const row = this.rows.get(jti);
    return Boolean(row?.revokedAt);
  }

  async revoke(jti: string, cascade: boolean, now = Date.now()): Promise<void> {
    const ts = Math.floor(now / 1000);
    const mark = (id: string) => {
      const row = this.rows.get(id);
      if (row && !row.revokedAt) {
        row.revokedAt = ts;
        this.rows.set(id, row);
      }
    };
    mark(jti);
    if (!cascade) return;
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
  }
}
