"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { priceFor } from "./pricing";
import {
  evenBreakdown,
  sanitizeBreakdown,
  sizeScaleFor,
  sizeTotal,
  type SizeBreakdown,
  type SizeScaleId,
} from "./sizes";

/* ---------------------------------------------------------------------------
 * Teklif listesi ("sipariş taslağı").
 * Faz 1 karari: sepet ve teklif ayri nesne degil. Bu liste gonderilirken
 * tipine gore ORDER ya da QUOTE olur. Fiyat verisi gelene kadar yalnizca
 * QUOTE modunda calisir.
 *
 * Beden dagilimi: her satirda bir toplam adet (qty) ve bunun bedenlere
 * dagilimi tutulur. Toplam ustadir; dagilimin toplami ona esit olmadan talep
 * gonderilemez. Ayni kural sunucuda da uygulanir (src/app/api/teklif).
 *
 * Kalicilik: sunucu yok, bu yuzden simdilik localStorage. Backend geldiginde
 * ayni arayuz bir API'ye baglanacak - bilesenler degismeyecek.
 * ------------------------------------------------------------------------ */

export type QuoteLine = {
  slug: string;
  name: string;
  image: string | null;
  colorId: string | null;
  colorName: string | null;
  /** Bu satir icin istenen toplam adet. */
  qty: number;
  /** Urunun beden olcegi: giyim, ayakkabi numarasi ya da tek beden. */
  scale: SizeScaleId;
  /** Toplamin bedenlere dagilimi. Tek bedenli urunlerde bos kalir. */
  sizes: SizeBreakdown;
  /* Fiyat alanlari yalnizca listede toplam gostermek icin tasinir. Gecerli
     fiyati sunucu her zaman urun kaydindan yeniden hesaplar. */
  priceMinor: number | null;
  wholesaleMinor: number | null;
  wholesaleMinQty: number | null;
  currency: string;
};

/** Bu satirda dagitilmayi bekleyen adet. Negatifse fazla dagitilmis demektir. */
export function remainingQty(line: QuoteLine): number {
  if (line.scale === "none") return 0;
  return line.qty - sizeTotal(line.sizes, line.scale);
}

type QuoteContext = {
  lines: QuoteLine[];
  totalQty: number;
  /** Fiyati girilmis satirlarin toplami, kurus. Fiyatsiz satirlar sayilmaz. */
  totalMinor: number;
  /** Listede fiyati tanimlanmamis urun var mi? */
  hasUnpricedLines: boolean;
  /** Beden dagilimi eksik ya da fazla olan satirlar. */
  incompleteLines: QuoteLine[];
  add: (line: QuoteLine) => void;
  setQty: (slug: string, colorId: string | null, qty: number) => void;
  setSize: (slug: string, colorId: string | null, size: string, qty: number) => void;
  autoFillSizes: (slug: string, colorId: string | null) => void;
  clearSizes: (slug: string, colorId: string | null) => void;
  remove: (slug: string, colorId: string | null) => void;
  clear: () => void;
  ready: boolean;
};

const KEY = "sima.quote.v1";
const Ctx = createContext<QuoteContext | null>(null);

function same(a: QuoteLine, slug: string, colorId: string | null) {
  return a.slug === slug && a.colorId === colorId;
}

/**
 * Kaydedilmis veriyi guvenli hale getirir.
 * Beden alanlari sonradan eklendigi icin eski kayitlarda yok; listeyi silmek
 * yerine eksik alanlar tamamlanir.
 */
function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function normalize(raw: unknown): QuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): QuoteLine[] => {
    if (!item || typeof item !== "object") return [];
    const l = item as Partial<QuoteLine>;
    if (typeof l.slug !== "string" || typeof l.name !== "string") return [];

    const scale: SizeScaleId =
      l.scale === "apparel" || l.scale === "shoe" || l.scale === "none"
        ? l.scale
        : "apparel";

    return [
      {
        slug: l.slug,
        name: l.name,
        image: typeof l.image === "string" ? l.image : null,
        colorId: typeof l.colorId === "string" ? l.colorId : null,
        colorName: typeof l.colorName === "string" ? l.colorName : null,
        qty: Math.max(1, Math.floor(Number(l.qty) || 1)),
        scale,
        sizes: sanitizeBreakdown(l.sizes, scale),
        priceMinor: numberOrNull(l.priceMinor),
        wholesaleMinor: numberOrNull(l.wholesaleMinor),
        wholesaleMinQty: numberOrNull(l.wholesaleMinQty),
        currency: typeof l.currency === "string" ? l.currency : "TRY",
      },
    ];
  });
}

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved) setLines(normalize(JSON.parse(saved)));
    } catch {
      // Depolama kapaliysa liste bos baslar; sayfa yine calisir.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // Yazilamiyorsa sessizce gec - kullanicinin akisi bozulmasin.
    }
  }, [lines, ready]);

  const add = useCallback((line: QuoteLine) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => same(l, line.slug, line.colorId));
      if (i === -1) return [...prev, line];
      // Ayni urun+renk yeniden eklendiginde adetler toplanir; beden dagilimi
      // artik eksik kalacagi icin kullanicinin tamamlamasi beklenir.
      const next = [...prev];
      const merged: SizeBreakdown = { ...next[i].sizes };
      for (const [key, value] of Object.entries(line.sizes)) {
        if (value > 0) merged[key] = (merged[key] ?? 0) + value;
      }
      next[i] = { ...next[i], qty: next[i].qty + line.qty, sizes: merged };
      return next;
    });
  }, []);

  const setQty = useCallback((slug: string, colorId: string | null, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (same(l, slug, colorId) ? { ...l, qty: Math.max(0, Math.floor(qty)) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const setSize = useCallback(
    (slug: string, colorId: string | null, size: string, qty: number) => {
      setLines((prev) =>
        prev.map((l) => {
          if (!same(l, slug, colorId)) return l;
          const value = Math.max(0, Math.floor(qty) || 0);
          const sizes = { ...l.sizes };
          if (value > 0) sizes[size] = value;
          else delete sizes[size];
          return { ...l, sizes };
        }),
      );
    },
    [],
  );

  const autoFillSizes = useCallback((slug: string, colorId: string | null) => {
    setLines((prev) =>
      prev.map((l) =>
        same(l, slug, colorId) ? { ...l, sizes: evenBreakdown(l.qty, l.scale) } : l,
      ),
    );
  }, []);

  const clearSizes = useCallback((slug: string, colorId: string | null) => {
    setLines((prev) => prev.map((l) => (same(l, slug, colorId) ? { ...l, sizes: {} } : l)));
  }, []);

  const remove = useCallback((slug: string, colorId: string | null) => {
    setLines((prev) => prev.filter((l) => !same(l, slug, colorId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<QuoteContext>(
    () => ({
      lines,
      totalQty: lines.reduce((s, l) => s + l.qty, 0),
      totalMinor: lines.reduce((s, l) => s + (priceFor(l, l.qty).totalMinor ?? 0), 0),
      hasUnpricedLines: lines.some((l) => l.priceMinor === null),
      incompleteLines: lines.filter((l) => remainingQty(l) !== 0),
      add,
      setQty,
      setSize,
      autoFillSizes,
      clearSizes,
      remove,
      clear,
      ready,
    }),
    [lines, add, setQty, setSize, autoFillSizes, clearSizes, remove, clear, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuote(): QuoteContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuote, QuoteProvider içinde kullanılmalı.");
  return ctx;
}

export { sizeScaleFor };
