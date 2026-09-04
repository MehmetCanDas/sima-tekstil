import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/catalog";

/* ---------------------------------------------------------------------------
 * Altbilgi.
 *
 * Sayfa sicak krem tonlarinda akiyor; altbilgi logodaki koyu kahveye donerek
 * bunu kapatiyor. Koyu zeminde logonun kahve parcalari kaybolacagi icin
 * ayri bir acik varyant kullaniliyor (public/brand/sima-logo-light.png).
 * ------------------------------------------------------------------------ */

const PRODUCT_LINKS = [
  { href: "/urunler?world=is-kiyafetleri", label: "İş Kıyafetleri" },
  { href: "/urunler?world=promosyon", label: "Promosyon Ürünleri" },
  { href: "/logo-uygulama", label: "Logo Nakış & Baskı" },
];

const CORPORATE_LINKS = [
  { href: "/iletisim", label: "İletişim" },
  { href: "/teklif", label: "Teklif Al" },
  { href: "/admin/veri-durumu", label: "Veri Durumu (iç)" },
];

export default function Footer({ brand }: { brand: Brand }) {
  return (
    <footer className="mt-24 bg-ink text-white/70">
      <div className="u-wrap grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/sima-logo-light.png"
            alt={brand.name}
            width={880}
            height={455}
            className="h-[68px] w-auto"
          />
          <p className="mt-4 text-[14px] text-white/55">{brand.tagline}</p>

          <p className="mt-6 max-w-[38ch] text-[14px] leading-relaxed text-white/55">
            {brand.address}
          </p>

          <div className="mt-6 flex flex-col gap-1.5 text-[14px]">
            <a
              href={`tel:${brand.phoneRaw}`}
              className="font-display text-[22px] font-semibold text-white transition-colors hover:text-accent"
            >
              {brand.phone}
            </a>
            <a
              href={`mailto:${brand.email}`}
              className="text-white/70 transition-colors hover:text-accent"
            >
              {brand.email}
            </a>
            <a
              href={`https://instagram.com/${brand.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 transition-colors hover:text-accent"
            >
              @{brand.instagram}
            </a>
            <span className="mt-1 text-white/45">
              {brand.owner} — {brand.ownerTitle}
            </span>
          </div>
        </div>

        <FooterColumn title="Ürünler" links={PRODUCT_LINKS} />
        <FooterColumn title="Kurumsal" links={CORPORATE_LINKS} />
      </div>

      {/* Yasal bilgiler henuz elimizde olmadigi icin uydurulmadi. */}
      <div className="border-t border-white/12">
        <div className="u-wrap flex flex-col gap-2 py-5 text-[12px] text-white/45 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {brand.name}. Tüm hakları saklıdır.
          </span>
          <span className="text-accent/80">
            Ticari unvan, vergi dairesi ve numarası eklenmeyi bekliyor.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {title}
      </h3>
      <ul className="mt-4 flex flex-col gap-2.5 text-[14px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-white/70 transition-colors hover:text-accent"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
