"use client";

import { saveUserAction } from "@/lib/admin/customers.actions";
import { ACCOUNT_STATUS } from "@/lib/admin/format";
import { ROLE_LABEL, ROLES } from "@/lib/auth/rbac";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Kullanici formu. Yeni hesap ve duzenleme icin ayni form kullanilir.
 *
 * Duzenlemede sifre alani bos birakilirsa sifre degismez. Sifre degistirilirse
 * kullanicinin acik oturumlari sunucuda kapatilir.
 * ------------------------------------------------------------------------ */

export type UserFormValues = {
  id?: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  companyId: string;
  role: string;
  status: string;
};

export function UserForm({
  values,
  companies,
  canAssignStaffRole,
  submitLabel,
}: {
  values: UserFormValues;
  companies: { id: string; name: string }[];
  canAssignStaffRole: boolean;
  submitLabel: string;
}) {
  const isNew = !values.id;
  // Personel rolleri yalnizca ekip yetkisi olanlara gosterilir; sunucu da dogrular.
  const roles = ROLES.filter(
    (r) => canAssignStaffRole || !["sales_manager", "admin", "super_admin"].includes(r),
  );

  return (
    <ActionForm action={saveUserAction} className="flex flex-col gap-4">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ad" name="name" required error={err("name")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={values.name} required />
                )}
              </Field>
              <Field label="Soyad" name="surname" error={err("surname")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.surname} />}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-posta" name="email" required error={err("email")}>
                {(p) => (
                  <input
                    {...p}
                    type="email"
                    className="a-input"
                    defaultValue={values.email}
                    autoComplete="off"
                    required
                  />
                )}
              </Field>
              <Field label="Telefon" name="phone" error={err("phone")}>
                {(p) => <input {...p} className="a-input" defaultValue={values.phone} />}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Firma" name="companyId" error={err("companyId")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={values.companyId}>
                    <option value="">— firmasız —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Rol" name="role" error={err("role")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={values.role}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Durum" name="status" error={err("status")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={values.status}>
                    {Object.entries(ACCOUNT_STATUS).map(([value, s]) => (
                      <option key={value} value={value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <Field
              label={isNew ? "Şifre" : "Yeni şifre"}
              name="password"
              required={isNew}
              error={err("password")}
              hint={
                isNew
                  ? "En az 10 karakter, bir harf ve bir rakam içermeli."
                  : "Boş bırakırsanız şifre değişmez. Değiştirirseniz açık oturumlar kapanır."
              }
            >
              {(p) => (
                <input
                  {...p}
                  type="password"
                  className="a-input"
                  autoComplete="new-password"
                  required={isNew}
                />
              )}
            </Field>

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
