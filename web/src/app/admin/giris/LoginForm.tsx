"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction } from "@/lib/auth/actions";

/**
 * Giris formu. Toaster panel kabugunda oldugu icin burada hata satir ici
 * gosterilir; giris ekrani panel saglayicilarindan bagimsizdir.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      <div>
        <label className="a-label" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="a-input"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="a-label" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="a-input"
          autoComplete="current-password"
          required
        />
      </div>

      {state && !state.ok ? (
        <p role="alert" className="border border-[#e0b4b1] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#b3261e]">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="a-btn a-btn-primary h-11 w-full" disabled={pending}>
      {pending ? "Kontrol ediliyor…" : "Giriş yap"}
    </button>
  );
}
