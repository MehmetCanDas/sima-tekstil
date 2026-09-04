import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/* ---------------------------------------------------------------------------
 * Sifre ozeti. scrypt (Node cekirdegi) kullanilir; ek bagimlilik yoktur.
 * Format: scrypt$N$r$p$<salt-b64>$<hash-b64>
 * Parametreler kayitli oldugu icin ileride maliyeti artirmak eski sifreleri
 * bozmaz: dogrulama kayitli parametreyle yapilir, gerekirse yeniden hash'lenir.
 * ------------------------------------------------------------------------ */

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  let key: Buffer;
  try {
    key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Kayitli ozet guncel maliyet parametreleriyle uretilmemisse true doner. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  return parts[0] !== "scrypt" || Number(parts[1]) < N;
}

export type PasswordProblem = string;

/** Zayif sifreleri sunucu tarafinda reddeder. */
export function validatePassword(password: string): PasswordProblem | null {
  if (password.length < 10) return "Şifre en az 10 karakter olmalı.";
  if (password.length > 200) return "Şifre çok uzun.";
  if (!/[a-zA-Z]/.test(password)) return "Şifre en az bir harf içermeli.";
  if (!/[0-9]/.test(password)) return "Şifre en az bir rakam içermeli.";
  return null;
}
