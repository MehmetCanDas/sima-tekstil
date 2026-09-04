"use client";

import { saveCompanyAction } from "@/lib/admin/customers.actions";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Firma formu (spec: 9).
 *
 * Iskonto yuzde olarak girilir; veritabaninda baz puan olarak saklanir, boylece
 * %12,5 gibi degerler kayipsiz tutulur.
 * ------------------------------------------------------------------------ */

export type CompanyFormValues = {
  id?: string;
  name: string;
  taxNumber: string;
  taxOffice: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  status: string;
  discountBp: number;
  currency: string;
};

export function CompanyForm({
  values,
  submitLabel,
}: {
  values: CompanyFormValues;
  submitLabel: string;
}) {
  return (
    <ActionForm action={saveCompanyAction} className="flex flex-col gap-4">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

            <Field label="Firma adı" name="name" required error={err("name")}>
              {(p) => <input {...p} className="a-input" defaultValue={values.name} required />}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Vergi numarası" name="taxNumber" error={err("taxNumber")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={values.taxNumber} />
                )}
              </Field>
              <Field label="Vergi dairesi" name="taxOffice" error={err("taxOffice")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={values.taxOffice} />
                )}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Ülke" name="country" error={err("country")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={values.country || "TR"} />
                )}
              </Field>
              <Field label="Şehir" name="city" error={err("city")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.city} />}
              </Field>
              <Field label="Telefon" name="phone" error={err("phone")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.phone} />}
              </Field>
            </div>

            <Field label="Adres" name="address" error={err("address")}>
              {(p) => (
                <textarea
                  {...p}
                  className="a-textarea"
                  rows={2}
                  defaultValue={values.address}
                />
              )}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-posta" name="email" error={err("email")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.email} />}
              </Field>
              <Field label="Web sitesi" name="website" error={err("website")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.website} />}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Durum" name="status" error={err("status")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={values.status}>
                    <option value="pending">Onay bekliyor</option>
                    <option value="active">Aktif</option>
                    <option value="suspended">Askıda</option>
                    <option value="archived">Arşiv</option>
                  </select>
                )}
              </Field>
              <Field
                label="Genel iskonto (%)"
                name="discount"
                error={err("discount")}
                hint="Ürün bazlı özel fiyat girilmemişse uygulanır."
              >
                {(p) => (
                  <input
                    {...p}
                    className="a-input"
                    inputMode="decimal"
                    defaultValue={(values.discountBp / 100).toString().replace(".", ",")}
                  />
                )}
              </Field>
              <Field label="Para birimi" name="currency" error={err("currency")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={values.currency || "TRY"}>
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                )}
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <SubmitButton>{submitLabel}</SubmitButton>
              {state && !state.ok ? (
                <span className="text-[13px] text-[#b3261e]">{state.error}</span>
              ) : null}
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
