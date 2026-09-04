import Image from "next/image";
import Link from "next/link";

import { money } from "@/lib/admin/format";
import { hasWholesaleTier } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/product-types";

/* ---------------------------------------------------------------------------
 * Katalog karti.
 *
 * Fotograflar beyaz zeminli cekildigi icin gorsel alani bilerek beyaz bir
 * plaka; krem sayfada "vitrindeki asili urun" gibi okunuyor.
 *
 * Fiyat: panelde liste fiyati girilmemis urunlerde fiyat yerine "Teklif Al"
 * yazar - uydurma bir rakam gosterilmez. Toptan kademe tanimliysa esik de
 * kartta belirtilir.
 * ------------------------------------------------------------------------ */

export default function ProductCard({ product }: { product: StoreProduct }) {
  const cover = product.images[0];
  const swatches = product.colors.slice(0, 5);
  const rest = product.colors.length - swatches.length;
  const tier = hasWholesaleTier(product);

  return (
    <Link
      href={`/urun/${product.slug}`}
      className="group flex flex-col outline-offset-4"
      aria-label={product.name}
    >
      <div className="u-plate u-lift relative aspect-[4/5] overflow-hidden group-hover:border-line-strong">
        {cover ? (
          <Image
            src={cover}
            alt={`${product.name} — ${product.categoryName}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-muted">
            Görsel bekleniyor
          </div>
        )}

        {product.images.length > 1 ? (
          <span className="absolute bottom-2.5 right-2.5 bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
            {product.images.length} görsel
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3.5">
        <span className="u-eyebrow">{product.categoryName}</span>
        <h3 className="font-display text-[19px] font-semibold leading-tight transition-colors group-hover:text-accent">
          {product.name}
        </h3>

        {product.fabrics.length > 0 && (
          <p className="line-clamp-1 text-[13px] text-muted">{product.fabrics.join(" · ")}</p>
        )}

        {swatches.length > 0 && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {swatches.map((c) => (
              <span
                key={c.label}
                title={c.label}
                className="block h-3.5 w-3.5 rounded-full border border-line-strong"
                style={
                  c.secondary
                    ? { background: `linear-gradient(135deg, ${c.hex} 50%, ${c.secondary.hex} 50%)` }
                    : { background: c.hex }
                }
              />
            ))}
            {rest > 0 && <span className="text-[12px] text-muted">+{rest}</span>}
          </div>
        )}

        <div className="mt-auto border-t border-line pt-2.5">
          {product.priceMinor !== null ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-display text-[22px] font-bold leading-none tabular-nums">
                  {money(product.priceMinor, product.currency)}
                </span>
                <span className="text-[12px] text-muted">
                  {product.moqUnit ? `/ ${product.moqUnit}` : "/ adet"}
                </span>
              </div>
              {tier ? (
                <p className="mt-1 text-[12px] text-accent">
                  {product.wholesaleMinQty}+ adet{" "}
                  <strong className="font-semibold tabular-nums">
                    {money(product.wholesaleMinor, product.currency)}
                  </strong>
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent">
                Teklif Al
                <span
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
              {product.moq && (
                <span className="text-[12px] tabular-nums text-muted">
                  Min. {product.moq} adet
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
