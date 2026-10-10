import type { TokenClaims } from "./types.js";

function b64url(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCodePoint(b);
  return btoa(bin)
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.codePointAt(i) ?? 0;
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return b64url(sig);
}

export function newJti(): string {
  return crypto.randomUUID();
}

export async function signToken(
  claims: TokenClaims,
  secret: string,
): Promise<string> {
  const payload = b64url(JSON.stringify(claims));
  const sig = await signPayload(payload, secret);
  return `pat.${payload}.${sig}`;
}

export type VerifyFail =
  | { ok: false; reason: "invalid_token" | "expired" }
  | { ok: true; claims: TokenClaims };

export async function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<VerifyFail> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pat") {
    return { ok: false, reason: "invalid_token" };
  }
  const [, payload, sig] = parts;
  const expected = await signPayload(payload, secret);
  const a = new TextEncoder().encode(sig);
  const b = new TextEncoder().encode(expected);
  if (!timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_token" };
  }
  let claims: TokenClaims;
  try {
    claims = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload)),
    ) as TokenClaims;
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) {
    return { ok: false, reason: "expired" };
  }
  if (!claims.jti || !Array.isArray(claims.grants)) {
    return { ok: false, reason: "invalid_token" };
  }
  return { ok: true, claims };
}
