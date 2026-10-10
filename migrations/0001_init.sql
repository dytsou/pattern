CREATE TABLE IF NOT EXISTS pattern_tokens (
  jti TEXT PRIMARY KEY,
  parent_jti TEXT,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pattern_tokens_parent ON pattern_tokens(parent_jti);
