"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import type { ActionResult } from "@/lib/admin/action";
import { useToast } from "./Toaster";

/* ---------------------------------------------------------------------------
 * Panelin ortak form ve tablo parcalari.
 * Hepsi sunucudan gelen ActionResult sozlesmesini konusur.
 * ------------------------------------------------------------------------ */

/** Gonderim sirasinda kendini kilitleyen buton. */
export function SubmitButton({
  children,
  className = "a-btn a-btn-primary",
  pendingText = "Kaydediliyor…",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}

type ActionFormProps<T> = {
  action: (prev: ActionResult<T> | null, formData: FormData) => Promise<ActionResult<T>>;
  children: (state: ActionResult<T> | null) => React.ReactNode;
  /** Basarili sonucta gosterilecek toast. */
  successMessage?: string;
  onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void;
  className?: string;
  /** Basaridan sonra formu sifirla (art arda kayit girisi icin). */
  resetOnSuccess?: boolean;
  /** Formun disindaki bir butonun form="..." ile baglanabilmesi icin. */
  id?: string;
};

/**
 * Server action'i useActionState ile baglar, sonucu toast'a dokar ve alan
 * hatalarini children'a gecirir.
 */
export function ActionForm<T>({
  action,
  children,
  successMessage,
  onSuccess,
  className,
  resetOnSuccess,
  id,
}: ActionFormProps<T>) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const seen = useRef<ActionResult<T> | null>(null);
  const submitted = useRef<FormData | null>(null);

  // Gonderilen degerleri sakla: React form action'i bitince formu sifirliyor,
  // dogrulama hatasinda kullanicinin yazdiklari aksi halde kayboluyor.
  const remember = useCallback(
    async (prev: ActionResult<T> | null, formData: FormData) => {
      submitted.current = formData;
      return action(prev, formData);
    },
    [action],
  );

  const [state, formAction] = useActionState(remember, null);

  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      const text = state.message ?? successMessage;
      if (text) toast.success(text);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else {
      toast.error(state.error);
      restoreValues(formRef.current, submitted.current);
    }
  }, [state, toast, successMessage, onSuccess, resetOnSuccess]);

  return (
    <form id={id} ref={formRef} action={formAction} className={className} noValidate>
      {children(state)}
    </form>
  );
}

/**
 * Sifirlanan formu, kullanicinin gonderdigi degerlerle yeniden doldurur.
 * Dosya alanlari guvenlik geregi programatik olarak doldurulamaz; atlanir.
 */
function restoreValues(form: HTMLFormElement | null, data: FormData | null) {
  if (!form || !data) return;

  const values = new Map<string, string[]>();
  for (const [key, value] of data.entries()) {
    if (typeof value !== "string") continue;
    const bucket = values.get(key);
    if (bucket) bucket.push(value);
    else values.set(key, [value]);
  }

  for (const element of Array.from(form.elements)) {
    const field = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!field.name) continue;
    const sent = values.get(field.name);

    if (field instanceof HTMLInputElement) {
      if (field.type === "file") continue;
      if (field.type === "checkbox" || field.type === "radio") {
        // Isaretlenmemis kutular FormData'ya hic girmez; yoklugu de bilgidir.
        field.checked = sent?.includes(field.value) ?? false;
        continue;
      }
    }
    if (sent && sent.length > 0) field.value = sent[0];
  }
}

/** Etiket + hata mesajini tek yerde toplayan alan sargisi. */
export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; name: string; "aria-invalid"?: "true" }) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label className="a-label" htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-accent">*</span> : null}
      </label>
      {children({ id, name, ...(error ? { "aria-invalid": "true" as const } : {}) })}
      {hint && !error ? <p className="a-hint">{hint}</p> : null}
      {error ? <p className="a-error">{error}</p> : null}
    </div>
  );
}

/**
 * Geri alinamaz islemler icin onay penceresi.
 *
 * Onay butonu formu normal sekilde gonderir. Pencere, gonderim BITTIGINDE
 * kapanir: onClick icinde kapatmak, submitter butonu form gonderilmeden
 * kaldirdigi icin islemi sessizce iptal ediyordu.
 */
export function ConfirmSubmit({
  title,
  body,
  confirmLabel = "Evet, devam et",
  children,
  className = "a-btn a-btn-danger",
  formAction,
  name,
  value,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  children: React.ReactNode;
  className?: string;
  formAction?: (formData: FormData) => void;
  name?: string;
  value?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? (
        <ConfirmDialog
          title={title}
          body={body}
          confirmLabel={confirmLabel}
          formAction={formAction}
          name={name}
          value={value}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  formAction,
  name,
  value,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  formAction?: (formData: FormData) => void;
  name?: string;
  value?: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();
  const dialogRef = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  // Gonderim bitince pencereyi kapat. Yonlendiren islemlerde sayfa zaten degisir.
  useEffect(() => {
    if (pending) submitted.current = true;
    else if (submitted.current) {
      submitted.current = false;
      onClose();
    }
  }, [pending, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,23,26,0.45)] p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-[min(440px,100%)] border border-line bg-bg p-6"
      >
        <h2 className="text-[20px] font-semibold uppercase">{title}</h2>
        <p className="mt-2 text-[14px] text-ink-2">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="a-btn a-btn-ghost"
            onClick={onClose}
            disabled={pending}
          >
            Vazgeç
          </button>
          <SubmitButton
            className="a-btn a-btn-danger"
            pendingText="İşleniyor…"
            formAction={formAction}
            name={name}
            value={value}
          >
            {confirmLabel}
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h3 className="text-[19px] font-semibold uppercase">{title}</h3>
      <p className="max-w-[46ch] text-[14px] text-ink-2">{body}</p>
      {action}
    </div>
  );
}
