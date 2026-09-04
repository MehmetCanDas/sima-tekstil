import { Img as Image } from "@/components/Img";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { FeatureCards, type FeatureCard } from "@/components/FeatureCards";
import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import { PopularProducts } from "@/components/PopularProducts";
import { HeroSwash, LeafMark, ThreadRule } from "@/components/brand/Flourish";
import { SectionHeading } from "@/components/brand/SectionHeading";
import { brand } from "@/lib/catalog";
import { categoryCounts } from "@/lib/product-filter";
import {
  getFeaturedProducts,
  getHomeCards,
  getHomeSlides,
  getPublishedProducts,
  getStoreCategories,
  getStoreSectors,
} from "@/lib/storefront";

const STEPS = [
  { t: "Ürünü seçin", d: "Katalogdan modeli ve rengi belirleyin." },
  { t: "Personel sayısını girin", d: "Teklif listenize adet ekleyin." },
  { t: "Teklif isteyin", d: "Firma bilgileriniz ve logonuzla gönderin." },
  { t: "Numune ve onay", d: "Kumaş ve logo uygulaması onayınıza sunulur." },
  { t: "Üretim ve sevkiyat", d: "Üretim tamamlanır, sevkiyat yapılır." },
];

const PROMISES = [
  { t: "Logo nakışı ve baskısı", d: "Her ürün firmanızın logosuyla üretilir." },
  { t: "Toptan üretim", d: "Personel sayınıza göre adetli sipariş." },
  { t: "Isparta merkezli", d: "Üretimden sevkiyata tek muhatap." },
];

/* Panelde yapilan degisiklik gecikmeden gorunsun diye sayfa her istekte
   yeniden uretilir. Katalog kucuk ve SQLite okumasi ucuz. */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const products = getPublishedProducts();
  const categories = getStoreCategories();
  const sectors = getStoreSectors();
  // Ilk on urun "Populer urunler" izgarasinda, kalanlar asagidaki secki
  // bolumunde gorunur; ayni urunun iki kez cikmasi onlenir.
  // Slayt ve kartlar panelden yonetilir (/admin/banner).
  const slides: HeroSlide[] = getHomeSlides().map((b) => ({
    src: b.imageUrl,
    alt: b.title ?? "Sima Üniforma",
    eyebrow: b.eyebrow ?? undefined,
    title: b.title ?? undefined,
    accentTitle: b.accentTitle ?? undefined,
    focus: b.focus ?? undefined,
    ctas: [
      ...(b.ctaLabel && b.ctaHref
        ? [{ href: b.ctaHref, label: b.ctaLabel, primary: true }]
        : []),
      ...(b.cta2Label && b.cta2Href ? [{ href: b.cta2Href, label: b.cta2Label }] : []),
    ],
  }));

  const cards: FeatureCard[] = getHomeCards().map((b) => ({
    href: b.ctaHref ?? "/urunler",
    title: b.title ?? "",
    subtitle: b.subtitle ?? "",
    image: b.imageUrl,
  }));

  const featured = getFeaturedProducts(18);
  const popular = featured.slice(0, 10);
  const gridProducts = featured.slice(10);
  const counts = categoryCounts(products);
  const workwear = categories.filter((c) => c.world === "is-kiyafetleri" && !c.parentId);

  // Kategori kartlarindaki gorsel: o kategorideki ilk fotografli urun.
  const categoryCover = new Map<string, string>();
  for (const p of products) {
    if (p.category && p.images[0] && !categoryCover.has(p.category)) {
      categoryCover.set(p.category, p.images[0]);
    }
  }

  return (
    <>
      {/* --------------------------------------------------------- Slayt */}
      <HeroSlider slides={slides} />

      {/* Slaytin uzerine binen uc giris karti */}
      <FeatureCards cards={cards} />

      {/* ------------------------------------------------ Populer urunler */}
      <PopularProducts products={popular} />

      {/* ------------------------------------------------------- Tanitim */}
      <section className="u-glow relative overflow-hidden border-y border-line">
        <HeroSwash />
        <div className="u-wrap relative grid items-center gap-10 py-14 md:py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="flex items-center gap-2.5">
              <LeafMark />
              <span className="u-eyebrow">{brand.tagline}</span>
            </span>

            <h1 className="mt-4 text-[clamp(32px,5.2vw,56px)] font-bold uppercase leading-[0.96]">
              Personelinizi <span className="text-accent">logonuzla</span> giydiriyoruz.
            </h1>

            <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-ink-2">
              İş montundan ikaz yeleğine, aşçı üniformasından güvenlik kıyafetine kadar
              kurumsal ve endüstriyel iş kıyafetleri — nakış ve baskı ile firmanıza özel
              üretilir.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/urunler" className="u-btn u-btn-primary">
                Ürünleri Keşfet
              </Link>
              <Link href="/teklif" className="u-btn u-btn-ghost">
                Toptan Teklif Al
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-6 border-t border-line-strong pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {[
              { n: "28", l: "kurumsal referans" },
              { n: String(products.length), l: "katalog ürünü" },
              { n: String(sectors.length), l: "hizmet verilen sektör" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="font-display text-[34px] font-bold leading-none tabular-nums">
                  {s.n}
                </dt>
                <dd className="mt-1.5 text-[13px] leading-tight text-muted">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------- Kisa vaat serit */}
      <section className="border-b border-line bg-bg">
        <ul className="u-wrap grid sm:grid-cols-3">
          {PROMISES.map((p) => (
            <li
              key={p.t}
              className="flex items-start gap-3 py-7 sm:px-6 sm:first:pl-0 sm:last:pr-0 sm:[&+li]:border-l sm:[&+li]:border-line"
            >
              <LeafMark className="mt-1 shrink-0" />
              <div>
                <h3 className="font-display text-[18px] font-semibold leading-tight">
                  {p.t}
                </h3>
                <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{p.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------------- Sektörler */}
      <section className="border-b border-line">
        <div className="u-wrap py-16 md:py-20">
          <SectionHeading
            eyebrow="Meslek grupları"
            title="Sektörünüze göre"
            description="Aynı ürünler, mesleğe göre ikinci bir giriş. Aradığınız çoğu zaman “gabardin pantolon” değil, “aşçı kıyafeti”dir."
          />

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sectors.map((s) => (
              <Link
                key={s.id}
                href={`/urunler?sector=${s.id}`}
                className="group u-lift flex items-center justify-between gap-3 border border-line bg-bg px-4 py-5 hover:border-accent/45"
              >
                <span className="font-display text-[19px] font-semibold leading-tight transition-colors group-hover:text-accent">
                  {s.name}
                </span>
                <span
                  aria-hidden
                  className="text-accent opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                >
                  →
                </span>
              </Link>
            ))}

            {/* Izgaranin son hucresini bos birakmamak icin katalog cikisi. */}
            <Link
              href="/urunler"
              className="group u-lift flex items-center justify-between gap-3 border border-accent/35 bg-accent-soft px-4 py-5 hover:border-accent"
            >
              <span className="font-display text-[19px] font-semibold leading-tight text-accent">
                Tüm katalog
              </span>
              <span
                aria-hidden
                className="text-accent transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Kategoriler */}
      <section className="border-b border-line bg-surface">
        <div className="u-wrap py-16 md:py-20">
          <SectionHeading
            eyebrow="Katalog"
            title="Kategoriler"
            description="İş kıyafetleri dünyasının tamamı; her kategoride farklı kumaş ve renk seçenekleriyle."
            href="/urunler"
          />

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {workwear.map((c) => {
              const cover = categoryCover.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/urunler?category=${c.id}`}
                  className="group u-lift flex flex-col border border-line bg-bg hover:border-accent/45"
                >
                  <div className="relative aspect-[5/4] overflow-hidden bg-white">
                    {cover ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
                        className="object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-t border-line px-3.5 py-3">
                    <span className="font-display text-[17px] font-semibold leading-tight transition-colors group-hover:text-accent">
                      {c.name}
                    </span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {counts.get(c.id) ?? 0}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Öne çıkanlar */}
      <section>
        <div className="u-wrap py-16 md:py-20">
          <SectionHeading
            eyebrow="Seçki"
            title="Öne çıkan ürünler"
            description="En çok tercih edilen modeller. Hepsi logo nakışı veya baskısıyla firmanıza özel üretilir."
            href="/urunler"
            linkLabel="Tüm katalog"
          />
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-11 md:grid-cols-3 lg:grid-cols-4">
            {gridProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Logo uygulaması */}
      <section className="border-y border-line bg-surface">
        <div className="u-wrap grid items-center gap-10 py-16 md:py-20 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative">
            <ThreadRule className="mb-6 text-accent/45" />
            <span className="u-eyebrow">Firmanıza özel</span>
            <h2 className="mt-3 text-[clamp(27px,3.6vw,42px)] font-semibold uppercase leading-[1.03]">
              Logonuz,
              <br />
              iğnenin ucunda.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-ink-2">
              Nakış mı, baskı mı? Kumaşa, adete ve logonuzun detayına göre değişir.
              Göğüs, sırt, yaka ve kol uygulamalarının hepsini tek atölyede yapıyoruz.
            </p>
            <Link href="/logo-uygulama" className="u-btn u-btn-primary mt-7">
              Nakış &amp; baskı seçenekleri
            </Link>
          </div>

          <ul className="grid gap-px bg-line sm:grid-cols-2">
            {[
              { t: "Nakış", d: "Kalıcı, dokulu ve kurumsal. Polo, gömlek ve montta tercih edilir." },
              { t: "Serigrafi baskı", d: "Yüksek adette ekonomik. Tişört ve sweatshirt için ideal." },
              { t: "Transfer baskı", d: "Çok renkli ve detaylı logolarda net sonuç." },
              { t: "Etiket ve aksesuar", d: "Boyun etiketi, kol bandı ve firma etiketleri." },
            ].map((x) => (
              <li key={x.t} className="bg-surface p-6">
                <h3 className="font-display text-[20px] font-semibold">{x.t}</h3>
                <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{x.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Süreç */}
      <section>
        <div className="u-wrap py-16 md:py-20">
          <SectionHeading
            eyebrow="Süreç"
            title="Nasıl çalışıyor?"
            description="Teklif isteğinden sevkiyata kadar beş adım."
            align="center"
          />

          {/* Adimlari birbirine baglayan iplik. */}
          <div aria-hidden className="mt-10 hidden md:block">
            <ThreadRule />
          </div>

          <ol className="mt-4 grid gap-x-5 gap-y-9 sm:grid-cols-2 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative">
                <span className="inline-flex h-9 w-9 items-center justify-center border border-accent/40 bg-accent-soft font-mono text-[12px] font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3.5 font-display text-[19px] font-semibold leading-tight">
                  {s.t}
                </h3>
                <p className="mt-1.5 text-[14px] leading-snug text-ink-2">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------------- CTA */}
      <section className="u-wrap pb-20 pt-4">
        <div className="relative overflow-hidden bg-ink px-8 py-14 text-center md:px-16 md:py-20">
          <HeroSwash tone="text-white/[0.07]" />
          <div className="relative mx-auto max-w-[60ch]">
            <span className="u-eyebrow text-white/55">Teklif</span>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] font-semibold uppercase leading-[1.04] text-white">
              Personel sayınızı söyleyin,
              <br />
              teklifinizi hazırlayalım.
            </h2>
            <p className="mx-auto mt-4 max-w-[48ch] text-[16px] leading-relaxed text-white/70">
              Kaç kişi, hangi ürün, hangi renk — gerisini biz hallederiz. Teklifiniz aynı
              gün içinde hazırlanır.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/teklif" className="u-btn u-btn-primary">
                Teklif Al
              </Link>
              <a
                href={`tel:${brand.phoneRaw}`}
                className="u-btn border-white/30 text-white hover:border-white hover:bg-white/10"
              >
                {brand.phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
