import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { settings } from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Site ayarlari ve feature flag'leri.
 *
 * Degerler JSON olarak saklanir; okuma istek basina onbelleklenir. Musteri
 * onay akisi gibi davranislar buradan acilip kapatilir (spec: 11).
 * ------------------------------------------------------------------------ */

export const SETTING_KEYS = {
  requireCustomerApproval: "require_customer_approval",
  pricesRequireApproval: "prices_require_approval",
  defaultCurrency: "default_currency",
  defaultMoqUnit: "default_moq_unit",
  lowStockThreshold: "low_stock_threshold",
} as const;

const loadAll = cache(async (): Promise<Map<string, unknown>> => {
  const rows = db.select({ key: settings.key, value: settings.value }).from(settings).all();
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      map.set(row.key, row.value);
    }
  }
  return map;
});

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const map = await loadAll();
  return map.has(key) ? (map.get(key) as T) : fallback;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  return Object.fromEntries(await loadAll());
}

export function writeSetting(key: string, value: unknown, actorId?: string): void {
  const payload = JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: payload, updatedAt: Date.now(), updatedBy: actorId ?? null })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: payload, updatedAt: Date.now(), updatedBy: actorId ?? null },
    })
    .run();
}
