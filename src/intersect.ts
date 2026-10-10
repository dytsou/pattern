import { matchPath } from "./path.js";
import type { AttenuationDiff, Grant } from "./types.js";

/** True iff every child grant is covered by some parent grant (same method, path ⊆). */
export function grantCoveredBy(child: Grant, parents: Grant[]): boolean {
  return parents.some(
    (p) => p.method === child.method && pathAtMost(child.path, p.path),
  );
}

/** child pattern is equal-or-narrower than parent pattern. */
function pathAtMost(childPat: string, parentPat: string): boolean {
  if (childPat === parentPat) return true;
  // Parent /** covers everything under prefix
  if (parentPat.endsWith("/**")) {
    const prefix = parentPat.slice(0, -3);
    let childPrefix = childPat;
    if (childPat.endsWith("/**")) childPrefix = childPat.slice(0, -3);
    else if (childPat.endsWith("/*")) childPrefix = childPat.slice(0, -2);
    return childPrefix === prefix || childPrefix.startsWith(prefix + "/");
  }
  if (parentPat.endsWith("/*")) {
    const prefix = parentPat.slice(0, -2);
    // child must be exactly one segment under prefix, or exact file under prefix
    if (childPat === parentPat) return true;
    if (
      childPat.startsWith(prefix + "/") &&
      !childPat.slice(prefix.length + 1).includes("/") &&
      !childPat.includes("*")
    ) {
      return true;
    }
    return false;
  }
  // exact parent: child must match that exact path only
  return childPat === parentPat || matchPath(parentPat, childPat);
}

export function intersectGrants(
  parentCaps: Grant[],
  requested: Grant[],
): { ok: true; grants: Grant[] } | { ok: false; excess: Grant[] } {
  const excess = requested.filter((r) => !grantCoveredBy(r, parentCaps));
  if (excess.length) return { ok: false, excess };
  return { ok: true, grants: requested };
}

export function buildDiff(opts: {
  excessGrants?: Grant[];
  expiryTooLong?: boolean;
  depthExceeded?: boolean;
}): AttenuationDiff {
  return {
    excessGrants: opts.excessGrants ?? [],
    expiryTooLong: opts.expiryTooLong ?? false,
    depthExceeded: opts.depthExceeded ?? false,
  };
}
