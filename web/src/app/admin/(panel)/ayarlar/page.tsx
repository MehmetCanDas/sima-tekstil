import type { Metadata } from "next";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { SETTING_KEYS, getSettings } from "@/lib/admin/settings";
import { SettingsForm } from "./SettingsForm";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  await requirePermission("settings.read");
  const me = (await getCurrentUser())!;
  const settings = await getSettings();

  return (
    <div className="mx-auto flex max-w-[840px] flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-bold uppercase">Ayarlar</h1>
        <p className="text-[13px] text-ink-2">
          Sitenin davranışını belirleyen anahtarlar. Değişiklikler işlem kayıtlarına yazılır.
        </p>
      </div>

      <SettingsForm
        canEdit={me.permissions.has("settings.update")}
        values={{
          requireCustomerApproval: Boolean(settings[SETTING_KEYS.requireCustomerApproval]),
          pricesRequireApproval: Boolean(settings[SETTING_KEYS.pricesRequireApproval]),
          defaultCurrency: String(settings[SETTING_KEYS.defaultCurrency] ?? "TRY"),
          defaultMoqUnit: String(settings[SETTING_KEYS.defaultMoqUnit] ?? "adet"),
          lowStockThreshold: Number(settings[SETTING_KEYS.lowStockThreshold] ?? 20),
        }}
      />

      <PasswordForm email={me.email} />
    </div>
  );
}
