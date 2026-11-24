import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from "node:crypto";

// OWASP's scrypt baseline (N=2^15, r=8, p=1): ~32 MiB and tens of ms per hash.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** `scrypt$N$r$p$salt$hash` (base64url), so the cost can rise without a migration. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { ...PARAMS, maxmem: MAX_MEM });
  const { N, r, p } = PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time check. A malformed or foreign hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const options = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEM };
  if (![options.N, options.r, options.p].every(Number.isSafeInteger)) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), options);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Checked when the email is unknown, so a miss costs as long as a wrong
 * password and the timing doesn't reveal which emails have accounts.
 */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}
