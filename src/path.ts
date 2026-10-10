/** Match path patterns: `*` = one segment, `**` = any suffix, exact otherwise. */
export function matchPath(pattern: string, path: string): boolean {
  const p = normalizePath(path);
  const pat = normalizePath(pattern);

  if (pat === "/**" || pat === "/*") return p.startsWith("/");

  if (pat.endsWith("/**")) {
    const prefix = pat.slice(0, -3);
    return p === prefix || p.startsWith(prefix + "/");
  }

  if (pat.endsWith("/*")) {
    const prefix = pat.slice(0, -2);
    if (!p.startsWith(prefix + "/") && p !== prefix) return false;
    const rest = p.slice(prefix.length + (p === prefix ? 0 : 1));
    if (p === prefix) return false;
    return rest.length > 0 && !rest.includes("/");
  }

  return p === pat;
}

export function normalizePath(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
