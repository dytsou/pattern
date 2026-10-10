export {
  createPattern,
  type CreatePatternOptions,
  type Pattern,
  type StaticRoot,
} from "./pattern.js";
export { decideFromClaims, grantsAllow } from "./decide.js";
export { matchPath, normalizePath } from "./path.js";
export { intersectGrants, grantCoveredBy, buildDiff } from "./intersect.js";
export { signToken, verifyToken, newJti } from "./token.js";
export { issueChild } from "./issue.js";
export {
  MemoryTokenStore,
  D1TokenStore,
  EpochTokenStore,
  isEpochTokenStore,
  epochAllows,
  type TokenStore,
  type TokenRecord,
  type TokenStoreStats,
  type D1Like,
} from "./store/index.js";
export type * from "./types.js";
