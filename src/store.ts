export interface TokenRecord {
  jti: string;
  parentJti?: string;
  kind: "access" | "delegation";
  expiresAt: number;
  revokedAt?: number;
}

export interface TokenStore {
  put(record: TokenRecord): Promise<void>;
  get(jti: string): Promise<TokenRecord | null>;
  /** Mark jti revoked; if cascade, also all descendants. */
  revoke(jti: string, cascade: boolean, now?: number): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
