"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/dal";
import { type ActionResult, fail, guard, ok } from "./action";
import { logActivity } from "./log";
import { SETTING_KEYS, getSettings, writeSetting } from "./settings";

/* ---------------------------------------------------------------------------
 * Site ayarlari ve feature flag'leri (spec: 11, 17).
 *
 * Onay akisi gibi davranislar buradan acilip kapatilir; kod degisikligi
 * gerekmez. Her degisiklik denetim kaydina yazilir.
 * ------------------------------------------------------------------------ */

export async function saveSettingsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("settings.update");
    const before = await getSettings();

    const threshold = Number(formData.get("lowStockThreshold"));
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1_000_000) {
      return fail("Stok eşiği 0 ile 1.000.000 arasında olmalı.", {
        lowStockThreshold: "Geçersiz değer.",
      });
    }

    const currency = String(formData.get("defaultCurrency") ?? "TRY").toUpperCase();
    if (!["TRY", "USD", "EUR"].includes(currency)) return fail("Geçersiz para birimi.");

    const next: Record<string, unknown> = {
      [SETTING_KEYS.requireCustomerApproval]:
        formData.get("requireCustomerApproval") === "on",
      [SETTING_KEYS.pricesRequireApproval]: formData.get("pricesRequireApproval") === "on",
      [SETTING_KEYS.defaultCurrency]: currency,
      [SETTING_KEYS.defaultMoqUnit]:
        String(formData.get("defaultMoqUnit") ?? "adet").trim().slice(0, 30) || "adet",
      [SETTING_KEYS.lowStockThreshold]: Math.floor(threshold),
    };

    for (const [key, value] of Object.entries(next)) writeSetting(key, value, actor.id);

    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) {
      if (JSON.stringify(before[key]) === JSON.stringify(value)) continue;
      changedBefore[key] = before[key];
      changedAfter[key] = value;
    }

    if (Object.keys(changedAfter).length > 0) {
      await logActivity({
        actor,
        action: "settings.update",
        entityType: "settings",
        entityLabel: "Site ayarları",
        before: changedBefore,
        after: changedAfter,
      });
    }

    revalidatePath("/admin/ayarlar");
    revalidatePath("/admin");
    return ok(undefined, "Ayarlar kaydedildi.");
  });
}
