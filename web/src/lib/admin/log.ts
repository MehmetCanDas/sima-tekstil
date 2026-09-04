import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { activityLog } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { requestIp } from "@/lib/auth/session";

/* ---------------------------------------------------------------------------
 * Denetim kaydi. Kritik her yazma islemi buradan gecer.
 * Log yazimi asla ana islemi dusurmemeli; hata yutulur ve sunucuya raporlanir.
 * ------------------------------------------------------------------------ */

export type LogEntry = {
  actor: SessionUser;
  action: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
};

export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    db.insert(activityLog)
      .values({
        id: randomUUID(),
        actorId: entry.actor.id,
        actorName: `${entry.actor.name} ${entry.actor.surname}`.trim(),
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        entityLabel: entry.entityLabel ?? null,
        before: entry.before === undefined ? null : JSON.stringify(entry.before),
        after: entry.after === undefined ? null : JSON.stringify(entry.after),
        ip: await requestIp(),
      })
      .run();
  } catch (error) {
    console.error("[activity-log] yazilamadi", error);
  }
}

/**
 * Her yazmada degisen, kendi basina bilgi tasimayan alanlar. Loga yazilirsa
 * gercek degisikligi gorunmez hale getirirler.
 */
const NOISY_FIELDS = new Set(["updatedAt", "createdAt", "passwordHash"]);

/**
 * Iki kaydin farkini cikarir; loga yalnizca degisen alanlar yazilir.
 * Boylece "fiyat 100 -> 120" gibi okunur kayitlar olusur.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (NOISY_FIELDS.has(String(key))) continue;
    const nextValue = after[key];
    if (nextValue === undefined) continue;
    if (Object.is(before[key], nextValue)) continue;
    b[key] = before[key];
    a[key] = nextValue;
    changed = true;
  }
  return changed ? { before: b, after: a } : null;
}
