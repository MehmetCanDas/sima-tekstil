"use client";

import { Img as Image } from "@/components/Img";
import Link from "next/link";
import { useState } from "react";

import { money } from "@/lib/admin/format";
import { hasWholesaleTier } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/product-types";
import { sizeScaleFor, useQuote } from "@/lib/quote-store";

/* ---------------------------------------------------------------------------
 * "Populer urunler" izgarasi.
 *
 * Her kartta iki islem var: urun sayfasina gitmek ve dogrudan teklif listesine
 * eklemek. Hizli ekleme varsayilan adetle (MOQ ya da 50) calisir; renk ve beden
 * dagilimi teklif listesinde tamamlanir - bu yuzden burada secim sorulmuyor.
 * ------------------------------------------------------------------------ */

export function PopularProducts({ products }: { products: StoreProduct[] }) {
  if (products.length === 0) return null;

  return (
    <section className="u-wrap py-14 md:py-16">
      <h2 className="text-center text-[clamp(24px,3.2vw,34px)] font-bold uppercase tracking-[0.04em]">
        Popüler Ürünler
      </h2>
      <p className="mx-auto mt-2 max-w-[54ch] text-center text-[14.5px] text-ink-2">
        En çok tercih edilen modeller. Hepsi logo nakışı veya baskısıyla firmanıza özel
        üretilir.
      </p>

      <ul className="mt-9 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((p) => (
          <li key={p.id}>
            <PopularCard product={p} />
          </li>
        ))}
      </ul>

      <div className="mt-9 text-center">
        <Link href="/urunler" className="u-btn u-btn-ghost">
          Tüm katalogu gör
        </Link>
      </div>
    </section>
  );
}

function PopularCard({ product }: { product: StoreProduct }) {
  const { add } = useQuote();
  const [added, setAdded] = useState(false);
  const tier = hasWholesaleTier(product);

  function quickAdd() {
    add({
      slug: product.slug,
      name: product.name,
      image: product.images[0] ?? null,
      colorId: product.colors[0]?.id ?? null,
      colorName: product.colors[0]?.label ?? null,
      // Varsayilan adet: urunun minimum siparisi, yoksa makul bir baslangic.
      qty: product.moq ?? 50,
      scale: sizeScaleFor(product.category),
      sizes: {},
      priceMinor: product.priceMinor,
      wholesaleMinor: product.wholesaleMinor,
      wholesaleMinQty: product.wholesaleMinQty,
      currency: product.currency,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <div className="flex h-full flex-col border border-line bg-bg">
      <Link
        href={`/urun/${product.slug}`}
        className="group relative block aspect-[4/5] overflow-hidden bg-white"
      >
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={`${product.name} — ${product.categoryName}`}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full place-items-center text-[12px] text-muted">
            Görsel bekleniyor
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <span className="u-eyebrow">{product.categoryName}</span>
        <Link
          href={`/urun/${product.slug}`}
          className="font-display text-[16px] font-semibold leading-tight transition-colors hover:text-accent"
        >
          {product.name}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          {product.priceMinor !== null ? (
            <>
              {tier && (
                <span className="text-[13px] text-muted line-through">
                  {money(product.priceMinor, product.currency)}
                </span>
              )}
              <span className="font-display text-[18px] font-bold tabular-nums">
                {money(
                  tier ? product.wholesaleMinor : product.priceMinor,
                  product.currency,
                )}
              </span>
              {tier && (
                <span className="text-[11px] text-accent">
                  {product.wholesaleMinQty}+ adet
                </span>
              )}
            </>
          ) : (
            <span className="text-[13px] font-semibold text-accent">
              Fiyat için teklif alın
            </span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
          <button
            type="button"
            onClick={quickAdd}
            className="u-btn u-btn-primary h-9 px-2 text-[12px]"
          >
            {added ? "Eklendi ✓" : "Toptan Al"}
          </button>
          <Link
            href="/logo-uygulama"
            className="u-btn u-btn-ghost h-9 px-2 text-[12px]"
          >
            Markalaştır
          </Link>
        </div>
      </div>
    </div>
  );
}
