import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt from node:crypto (no native build step, no extra dependency).
 * Parameters follow OWASP guidance: N=2^15, r=8, p=2 (about 32 MiB and ~100 ms per hash).
 * Stored format: scrypt$N$r$p$<salt b64url>$<hash b64url>, so parameters can be raised later
 * without invalidating existing hashes.
 */
const PARAMS = { N: 32_768, r: 8, p: 2, keyLength: 64 } as const;
const SALT_BYTES = 16;
const MAX_INPUT_LENGTH = 1_024;

function maxMemoryFor(N: number, r: number): number {
  // The Node default maxmem (32 MiB) is exactly what N=2^15, r=8 needs; give it headroom.
  return 128 * N * r * 2;
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      { N: params.N, r: params.r, p: params.p, maxmem: maxMemoryFor(params.N, params.r) },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0 || password.length > MAX_INPUT_LENGTH) {
    throw new Error("Password must be a non-empty string of reasonable length.");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await deriveKey(password, salt, PARAMS.keyLength, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parseStoredHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const hash = Buffer.from(parts[5] ?? "", "base64url");
  if (salt.length === 0 || hash.length === 0) return null;
  return { N, r, p, salt, hash };
}

/** Constant-time comparison against a stored hash. Returns false for malformed input. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || typeof password !== "string" || password.length === 0 || password.length > MAX_INPUT_LENGTH) {
    return false;
  }
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const derived = await deriveKey(password, parsed.salt, parsed.hash.length, parsed);
  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

let dummyHashPromise: Promise<string> | undefined;

/**
 * A real hash of a random password, used to keep the response time of an
 * unknown-email login close to that of a wrong-password login.
 */
export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHashPromise;
}
