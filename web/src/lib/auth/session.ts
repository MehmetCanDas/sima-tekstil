import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Oturum yonetimi.
 *
 * Cookie yalnizca rastgele bir token tasir. Veritabaninda token'in kendisi
 * degil SHA-256 ozeti tutulur; veritabani sizsa bile cerezler uretilemez.
 * ------------------------------------------------------------------------ */

export const SESSION_COOKIE = "sima_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 saat

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;

  db.insert(sessions)
    .values({
      id: digest(token),
      userId,
      expiresAt,
      ip: await requestIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    })
    .run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Cerezdeki token'a karsilik gelen gecerli oturumun kullanici kimligi. */
export async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, digest(token)))
    .get();

  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    db.delete(sessions).where(eq(sessions.id, digest(token))).run();
    return null;
  }
  return row.userId;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, digest(token))).run();
  store.delete(SESSION_COOKIE);
}

/** Bir kullanicinin tum oturumlarini kapatir (askiya alma, sifre degisimi). */
export function destroyAllSessionsFor(userId: string): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/** Suresi dolmus oturumlari temizler. Girislerde firsatci olarak cagrilir. */
export function pruneExpiredSessions(): void {
  db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}

export function touchLogin(userId: string, ip: string | null): void {
  db.update(users)
    .set({ lastLoginAt: Date.now(), lastLoginIp: ip, failedLogins: 0, lockedUntil: null })
    .where(and(eq(users.id, userId)))
    .run();
}
