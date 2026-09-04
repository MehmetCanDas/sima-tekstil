"use client";

import { changeOwnPasswordAction } from "@/lib/auth/actions";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

/** Oturum sahibinin kendi sifresini degistirmesi. Diger oturumlar kapanir. */
export function PasswordForm({ email }: { email: string }) {
  return (
    <ActionForm action={changeOwnPasswordAction} resetOnSuccess className="a-card p-5">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              Şifremi değiştir
            </h2>
            <p className="mb-4 text-[12px] text-muted">
              {email} · Şifre değişince diğer cihazlardaki oturumlarınız kapanır.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mevcut şifre" name="current" required error={err("current")}>
                {(p) => (
                  <input
                    {...p}
                    type="password"
                    className="a-input"
                    autoComplete="current-password"
                    required
                  />
                )}
              </Field>
              <Field
                label="Yeni şifre"
                name="next"
                required
                error={err("next")}
                hint="En az 10 karakter, bir harf ve bir rakam."
              >
                {(p) => (
                  <input
                    {...p}
                    type="password"
                    className="a-input"
                    autoComplete="new-password"
                    required
                  />
                )}
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <SubmitButton>Şifreyi güncelle</SubmitButton>
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
