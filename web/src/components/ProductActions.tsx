"use client";

import Link from "next/link";
import { useState } from "react";
import { sizeScaleFor, useQuote } from "@/lib/quote-store";
import { money } from "@/lib/admin/format";
import { hasWholesaleTier, priceFor } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/product-types";

const MIN_QTY = 15;
const PRESETS = [15, 25, 50, 100, 250];

export default function ProductActions({ product }: { product: StoreProduct }) {
  const { add } = useQuote();
  const [colorIndex, setColorIndex] = useState(product.colors.length > 0 ? 0 : -1);
  const [qty, setQty] = useState(50);
  const [added, setAdded] = useState(false);

  const color = colorIndex >= 0 ? product.colors[colorIndex] : null;
  const scale = sizeScaleFor(product.category);
  const tier = hasWholesaleTier(product);
  const price = priceFor(product, qty);

  function handleAdd() {
    add({
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? null,
      colorId: color?.id ?? null,
      colorName: color?.label ?? null,
      qty,
      // Fiyat anlik gorunum icin tasinir; gecerli fiyat her zaman sunucuda
      // urun kaydindan yeniden hesaplanir.
      priceMinor: product.priceMinor,
      wholesaleMinor: product.wholesaleMinor,
      wholesaleMinQty: product.wholesaleMinQty,
      currency: product.currency,
      // Beden dagilimi teklif listesinde yapilir: kullanici once toplam adedi
      // belirler, sonra tek ekranda tum urunlerin bedenlerini dagitir.
      scale,
      sizes: {},
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      {product.colors.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="u-eyebrow">Renk</h2>
            <span className="text-[13px] text-muted">{color?.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.colors.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setColorIndex(i)}
                title={c.label}
                aria-label={c.label}
                aria-pressed={i === colorIndex}
                className={`h-9 w-9 rounded-full border-2 transition-transform ${
                  i === colorIndex
                    ? "scale-110 border-accent"
                    : "border-line-strong hover:scale-105"
                }`}
                style={
                  c.secondary
                    ? {
                        background: `linear-gradient(135deg, ${c.hex} 50%, ${c.secondary.hex} 50%)`,
                      }
                    : { background: c.hex }
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="border-l-2 border-line-strong pl-3 text-[14px] text-muted">
          Bu ürün için renk seçenekleri katalogda belirtilmemiş. Mevcut renkleri
          teklif aşamasında paylaşıyoruz.
        </p>
      )}

      <div>
        <h2 className="u-eyebrow">Adet</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQty(n)}
              className={`h-10 min-w-[58px] border px-3 text-[14px] font-semibold tabular-nums transition-colors ${
                qty === n
                  ? "border-accent bg-accent text-white"
                  : "border-line-strong hover:border-ink"
              }`}
            >
              {n}
            </button>
          ))}
          <label className="flex items-center gap-2">
            <span className="sr-only">Özel adet</span>
            <input
              type="number"
              min={MIN_QTY}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(MIN_QTY, Number(e.target.value) || MIN_QTY))}
              className="h-10 w-24 border border-line-strong px-3 text-[14px] tabular-nums outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>

      {product.priceMinor !== null && (
        <div
          className={`border p-4 transition-colors ${
            price.wholesaleApplied
              ? "border-ok/40 bg-ok/[0.06]"
              : "border-line bg-surface"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[13px] text-ink-2">
              {qty} {product.moqUnit ?? "adet"} ×{" "}
              <strong className="tabular-nums">
                {money(price.unitMinor, product.currency)}
              </strong>
              {price.wholesaleApplied && (
                <span className="ml-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ok">
                  toptan fiyat
                </span>
              )}
            </span>
            <span className="font-display text-[26px] font-bold leading-none tabular-nums">
              {money(price.totalMinor, product.currency)}
            </span>
          </div>

          {tier && !price.wholesaleApplied && (
            <p className="mt-2 border-t border-line pt-2 text-[13px] text-accent">
              <strong className="font-semibold tabular-nums">
                {product.wholesaleMinQty} adet
              </strong>{" "}
              ve üzeri siparişlerde birim fiyat{" "}
              <strong className="font-semibold tabular-nums">
                {money(product.wholesaleMinor, product.currency)}
              </strong>
              {price.savingPerUnitMinor ? (
                <> — {qty > 0 ? `${price.qtyToWholesale} adet daha ekleyin, ` : ""}adet
                başına {money(price.savingPerUnitMinor, product.currency)} kazanın.</>
              ) : (
                "."
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleAdd} className="u-btn u-btn-primary flex-1">
          {added ? "Listeye eklendi ✓" : "Teklif listesine ekle"}
        </button>
        <Link href="/teklif" className="u-btn u-btn-ghost">
          Teklif listesi
        </Link>
      </div>

      <p className="text-[13px] leading-relaxed text-muted">
        Fiyat; adet, kumaş seçimi ve logo uygulamasına (nakış / baskı) göre
        belirlenir. Teklifiniz aynı gün içinde hazırlanır.
      </p>
    </div>
  );
}
