"use client";

import { saveSettingsAction } from "@/lib/admin/settings.actions";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

export function SettingsForm({
  values,
  canEdit,
}: {
  values: {
    requireCustomerApproval: boolean;
    pricesRequireApproval: boolean;
    defaultCurrency: string;
    defaultMoqUnit: string;
    lowStockThreshold: number;
  };
  canEdit: boolean;
}) {
  return (
    <ActionForm action={saveSettingsAction} className="a-card p-5">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              B2B davranışı
            </h2>

            <fieldset disabled={!canEdit} className="flex flex-col gap-4">
              <Toggle
                name="requireCustomerApproval"
                defaultChecked={values.requireCustomerApproval}
                title="Yeni kayıtlar admin onayı beklesin"
                body="Kapalıyken siteye kayıt olan herkes hemen giriş yapabilir. Açıkken hesaplar “Onay bekliyor” durumunda açılır ve Kullanıcılar ekranından onaylanır."
              />
              <Toggle
                name="pricesRequireApproval"
                defaultChecked={values.pricesRequireApproval}
                title="Fiyatları yalnızca onaylı B2B müşteriler görsün"
                body="Açıkken ziyaretçiler ve onaylanmamış hesaplar fiyat göremez, yalnızca teklif isteyebilir."
              />

              <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-3">
                <Field label="Varsayılan para birimi" name="defaultCurrency">
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.defaultCurrency}>
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  )}
                </Field>
                <Field label="Varsayılan MOQ birimi" name="defaultMoqUnit">
                  {(p) => (
                    <input {...p} className="a-input" defaultValue={values.defaultMoqUnit} />
                  )}
                </Field>
                <Field
                  label="Düşük stok eşiği"
                  name="lowStockThreshold"
                  error={err("lowStockThreshold")}
                  hint="Panelde uyarı verilecek sınır."
                >
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      type="number"
                      min={0}
                      defaultValue={values.lowStockThreshold}
                    />
                  )}
                </Field>
              </div>
            </fieldset>

            {canEdit ? (
              <div className="mt-5 flex items-center gap-3">
                <SubmitButton>Ayarları kaydet</SubmitButton>
                {state && !state.ok ? (
                  <span className="text-[13px] text-[#b3261e]">{state.error}</span>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-[13px] text-muted">
                Ayarları görüntüleyebilirsiniz; değiştirme yetkiniz yok.
              </p>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}

function Toggle({
  name,
  defaultChecked,
  title,
  body,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  body: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span>
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[12.5px] text-ink-2">{body}</span>
      </span>
    </label>
  );
}
