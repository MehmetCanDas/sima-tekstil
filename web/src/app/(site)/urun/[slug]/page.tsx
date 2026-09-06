import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import ProductActions from "@/components/ProductActions";
import ProductCard from "@/components/ProductCard";
import { LeafMark } from "@/components/brand/Flourish";
import { SectionHeading } from "@/components/brand/SectionHeading";
import { brand } from "@/lib/catalog";
import { money } from "@/lib/admin/format";
import { hasWholesaleTier } from "@/lib/pricing";
import { makeCatalogIndex } from "@/lib/product-filter";
import {
  getPublishedProduct,
  getRelatedProducts,
  getStoreCategories,
  getStoreSectors,
} from "@/lib/storefront";

type Params = { params: Promise<{ slug: string }> };

/* Panelde yapilan degisiklik gecikmeden gorunsun diye statik uretim yerine
   istek aninda render edilir. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = getPublishedProduct(slug);
  if (!p) return {};
  const title = p.seoTitle ?? `${p.name} — Toptan ${p.categoryName}`;
  const description =
    p.seoDescription ??
    `${p.name}. ${
      p.colors.length > 0 ? `${p.colors.length} renk seçeneği. ` : ""
    }Kurumsal ve endüstriyel iş kıyafeti, logo nakışı ve baskısı ile firmanıza özel üretim.`;
  return {
    title,
    description,
    alternates: { canonical: `/urun/${p.slug}` },
    openGraph: { title, description, images: p.images[0] ? [p.images[0]] : [] },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = getPublishedProduct(slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 4);
  const index = makeCatalogIndex(getStoreCategories(), getStoreSectors());
  const tier = hasWholesaleTier(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        category: product.categoryName,
        image: product.images.slice(0, 4),
        brand: { "@type": "Brand", name: brand.name },
        // Fiyat verisi olmadigi icin Offer yazilmiyor. Yanlis yapisal veri,
        // eksik yapisal veriden daha kotudur.
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "/" },
          { "@type": "ListItem", position: 2, name: "Ürünler", item: "/urunler" },
          {
            "@type": "ListItem",
            position: 3,
            name: product.categoryName,
            item: `/urunler?category=${product.category}`,
          },
          { "@type": "ListItem", position: 4, name: product.name },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="u-wrap pt-6">
        <nav aria-label="Sayfa yolu" className="text-[13px] text-muted">
          <Link href="/" className="hover:text-accent">
            Ana Sayfa
          </Link>
          <span className="px-2">/</span>
          <Link href="/urunler" className="hover:text-accent">
            Ürünler
          </Link>
          <span className="px-2">/</span>
          <Link href={`/urunler?category=${product.category ?? ""}`} className="hover:text-accent">
            {product.categoryName}
          </Link>
        </nav>
      </div>

      <article className="u-wrap grid gap-12 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Gallery images={product.images} alt={product.name} />

        <div className="flex flex-col gap-7">
          <header>
            <span className="u-eyebrow">{product.categoryName}</span>
            <h1 className="mt-2 text-[clamp(28px,4vw,44px)] font-bold uppercase">
              {product.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>
                Ürün kodu:{" "}
                <span className="font-mono text-ink-2">
                  {product.sku ?? "atanmadı"}
                </span>
              </span>
              <span>Katalog s. {product.sourcePage}</span>
            </div>
          </header>

          <div className="border border-accent/30 bg-accent-soft p-5">
            {product.priceMinor !== null ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[38px] font-bold leading-none">
                    {money(product.priceMinor, product.currency)}
                  </span>
                  <span className="text-[14px] text-ink-2">
                    / {product.moqUnit ?? "adet"}
                  </span>
                </div>
                {tier ? (
                  <p className="mt-3 border-t border-accent/25 pt-3 text-[14px] leading-relaxed">
                    <strong className="font-semibold tabular-nums text-accent">
                      {product.wholesaleMinQty} adet
                    </strong>{" "}
                    ve üzeri siparişlerde toptan fiyat{" "}
                    <strong className="font-semibold tabular-nums text-accent">
                      {money(product.wholesaleMinor, product.currency)}
                    </strong>{" "}
                    / {product.moqUnit ?? "adet"} olarak uygulanır.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <span className="font-display text-[32px] font-bold leading-none text-accent">
                  Teklife özel fiyat
                </span>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                  Fiyat; adet, kumaş seçimi ve logo uygulamasına göre belirlenir.
                  Listenizi gönderin, aynı gün dönüş yapalım.
                </p>
              </>
            )}

            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-accent/25 pt-3.5 text-[13px]">
              <div>
                <dt className="text-muted">Minimum sipariş</dt>
                <dd className="font-semibold">15 adet</dd>
              </div>
              <div>
                <dt className="text-muted">Renk seçeneği</dt>
                <dd className="font-semibold">{product.colors.length || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Logo uygulaması</dt>
                <dd className="font-semibold">Nakış / baskı</dd>
              </div>
            </dl>
          </div>

          <ProductActions product={product} />
        </div>
      </article>

      {/* ---------------------------------------------------------- Detaylar */}
      <section className="u-wrap grid gap-10 border-t border-line py-12 md:grid-cols-2">
        <div>
          <span className="flex items-center gap-2.5">
            <LeafMark />
            <span className="u-eyebrow">Detaylar</span>
          </span>
          <h2 className="mt-2.5 text-[28px] font-semibold uppercase">Ürün bilgisi</h2>

          {product.description ? (
            <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">
              {product.description}
            </p>
          ) : null}

          <dl className="mt-5 divide-y divide-line border-y border-line text-[14px]">
            <Row label="Kategori" value={product.categoryName} />
            <Row
              label="Kumaş"
              value={product.fabrics.length > 0 ? product.fabrics.join(", ") : null}
            />
            <Row
              label="Renk seçenekleri"
              value={
                product.colors.length > 0
                  ? product.colors.map((c) => c.label).join(", ")
                  : null
              }
            />
            <Row label="Kumaş içeriği" value={product.fabricContent} />
            <Row
              label="Ürün özellikleri"
              value={product.features.length > 0 ? product.features.join(", ") : null}
            />
            <Row
              label="Kullanım alanı"
              value={
                product.sectors.length > 0
                  ? product.sectors.map(index.sectorName).join(", ")
                  : null
              }
            />
          </dl>
        </div>

        <div>
          <span className="flex items-center gap-2.5">
            <LeafMark />
            <span className="u-eyebrow">Firmanıza özel</span>
          </span>
          <h2 className="mt-2.5 text-[28px] font-semibold uppercase">Logo uygulaması</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Tüm ürünler firmanızın logosu ile üretilebilir. Nakış ve baskı
            seçenekleri, uygulama bölgeleri, ek ücret ve minimum adet bilgisi
            firmadan alındığında bu bölüme eklenecek.
          </p>
          <div className="mt-6 border border-line bg-surface p-6">
            <h3 className="font-display text-[22px] font-semibold">Sorunuz mu var?</h3>
            <p className="mt-1 text-[14px] text-ink-2">
              Kumaş, gramaj ve teslim süresi için doğrudan arayın.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={`tel:${brand.phoneRaw}`} className="u-btn u-btn-primary">
                {brand.phone}
              </a>
              <a href={`mailto:${brand.email}`} className="u-btn u-btn-ghost">
                E-posta
              </a>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="u-wrap border-t border-line py-14">
          <SectionHeading
            eyebrow="Aynı kategoriden"
            title="Benzer ürünler"
            href={`/urunler?category=${product.category ?? ""}`}
            linkLabel="Kategoriyi gör"
          />
          <div className="mt-9 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string | null;
  note?: string;
}) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd>
        {value ?? <span className="text-muted">Belirtilmemiş</span>}
        {note && <p className="mt-1 text-[13px] text-warn">{note}</p>}
      </dd>
    </div>
  );
}
