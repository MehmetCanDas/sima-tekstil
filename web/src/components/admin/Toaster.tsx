"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ---------------------------------------------------------------------------
 * Toast bildirimleri. Panelde her yazma isleminin sonucu buradan duyurulur.
 * Ekran okuyucular icin bolge aria-live; hata toast'lari otomatik kapanmaz.
 * ------------------------------------------------------------------------ */

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };

type ToastApi = {
  push: (text: string, tone?: Tone) => void;
  success: (text: string) => void;
  error: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function Toaster({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((text: string, tone: Tone = "info") => {
    setItems((list) => [...list, { id: nextId++, tone, text }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (text) => push(text, "success"),
      error: (text) => push(text, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(380px,calc(100vw-40px))] flex-col gap-2"
      >
        {items.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    // Hatalar kullanici kapatana kadar durur; okunmadan kaybolmamali.
    if (toast.tone === "error") return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast.tone, onClose]);

  const tone =
    toast.tone === "success"
      ? "border-l-ok"
      : toast.tone === "error"
        ? "border-l-[#b3261e]"
        : "border-l-line-strong";

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 border border-line border-l-4 bg-bg px-4 py-3 text-[13px] shadow-[0_6px_24px_rgba(20,23,26,0.13)] ${tone}`}
    >
      <span className="flex-1">{toast.text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="-mr-1 -mt-0.5 px-1 text-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast, Toaster içinde kullanılmalı.");
  return api;
}
