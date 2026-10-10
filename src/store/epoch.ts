import type { TokenRecord, TokenStore } from "./types.js";

function finiteEpoch(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** True when the token's stamped epoch is a finite number matching the store. */
export function epochAllows(
  claimsEpoch: unknown,
  currentEpoch: number,
): boolean {
  return (
    typeof claimsEpoch === "number" &&
    Number.isFinite(claimsEpoch) &&
    claimsEpoch === currentEpoch
  );
}

/**
 * Ultra-minimal revoke: one generation counter.
 * Mint stamps `claims.epoch`; `revoke` bumps the counter and invalidates every prior token.
 * ponytail: no per-jti mesh / cascade — persist `state` (KV/DO) yourself if you need durability.
 */
export class EpochTokenStore implements TokenStore {
  readonly mode = "epoch" as const;

  constructor(public readonly state: { epoch: number } = { epoch: 0 }) {
    // Fail closed: partial KV hydrates (`{}`) must not leave epoch undefined.
    this.state.epoch = finiteEpoch(this.state.epoch, 0);
  }

  currentEpoch(): number {
    return finiteEpoch(this.state.epoch, 0);
  }

  bumpEpoch(): number {
    this.state.epoch = this.currentEpoch() + 1;
    return this.state.epoch;
  }

  put(_record: TokenRecord): Promise<void> {
    return Promise.resolve();
  }

  get(_jti: string): Promise<TokenRecord | null> {
    return Promise.resolve(null);
  }

  isRevoked(_jti: string): Promise<boolean> {
    // Claims carry epoch; Pattern.verify compares against currentEpoch().
    return Promise.resolve(false);
  }

  revoke(_jti: string, _cascade: boolean, _now?: number): Promise<void> {
    this.bumpEpoch();
    return Promise.resolve();
  }
}

export function isEpochTokenStore(store: TokenStore): store is EpochTokenStore {
  return "mode" in store && (store as { mode?: string }).mode === "epoch";
}
