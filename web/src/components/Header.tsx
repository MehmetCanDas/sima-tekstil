"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuote } from "@/lib/quote-store";

/* ---------------------------------------------------------------------------
 * Vitrin basligi - uc katli.
 *
 *   1. Ince iletisim seridi (koyu)   -> sayfayla birlikte kayar
 *   2. Logo + arama + teklif listesi -> yapiskan
 *   3. Ana gezinme                   -> yapiskan
 *
 * Ust serit yapiskan degil: ilk ekranda iletisim bilgisi gorunur ama sayfa
 * kaydirilinca yer kaplamaz. Yapiskan yukseklik 118px; hero yuksekligi bu
 * degere gore hesaplanir (HeroSlider).
 * ------------------------------------------------------------------------ */

const NAV = [
  { href: "/urunler?world=is-kiyafetleri", label: "İş Kıyafetleri", match: "/urunler" },
  { href: "/urunler?world=promosyon", label: "Promosyon", match: "/promosyon" },
  { href: "/logo-uygulama", label: "Logo Nakış & Baskı", match: "/logo-uygulama" },
  { href: "/teklif", label: "Teklif Al", match: "/teklif" },
  { href: "/iletisim", label: "İletişim", match: "/iletisim" },
];

export default function Header({ phone, phoneRaw }: { phone: string; phoneRaw: string }) {
  const path = usePathname();
  const router = useRouter();
  const { totalQty, ready } = useQuote();
  const [open, setOpen] = useState(false);

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    router.push(q ? `/urunler?q=${encodeURIComponent(q)}` : "/urunler");
    setOpen(false);
  }

  return (
    <>
      {/* ---------------------------------------------- 1. iletisim seridi */}
      <div className="hidden bg-ink text-white/75 md:block">
        <div className="u-wrap flex h-9 items-center justify-between text-[12px]">
          <span>Kurumsal ve endüstriyel iş kıyafetleri · Nakış ve baskı · Isparta</span>
          <div className="flex items-center gap-5">
            <Link href="/iletisim" className="transition-colors hover:text-white">
              İletişim
            </Link>
            <a
              href={`tel:${phoneRaw}`}
              className="font-semibold text-white transition-colors hover:text-accent"
            >
              {phone}
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        {/* ------------------------------------- 2. logo + arama + teklif */}
        <div className="u-wrap flex h-[72px] items-center gap-5">
          <Link href="/" className="shrink-0" aria-label="Sima Üniforma ana sayfa">
            <Image
              src="/brand/sima-logo.png"
              alt="Sima Üniforma"
              width={880}
              height={455}
              priority
              className="h-11 w-auto sm:h-[52px]"
            />
          </Link>

          <form
            onSubmit={onSearch}
            role="search"
            className="hidden max-w-[420px] flex-1 items-center border border-line-strong bg-bg focus-within:border-accent lg:flex"
          >
            <input
              name="q"
              type="search"
              placeholder="Ürün, kategori veya kumaş ara…"
              aria-label="Ürün ara"
              className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none"
            />
            <button
              type="submit"
              aria-label="Ara"
              className="h-10 px-3.5 text-[15px] text-muted transition-colors hover:text-accent"
            >
              ⌕
            </button>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/teklif" className="u-btn u-btn-primary h-10 px-4 text-[13px]">
              Teklif Listesi
              <span className="inline-flex min-w-[20px] justify-center bg-black/20 px-1.5 text-[12px] tabular-nums">
                {ready ? totalQty : 0}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Menüyü aç"
              className="flex h-10 w-10 items-center justify-center border border-line-strong transition-colors hover:border-ink lg:hidden"
            >
              <span className="text-lg leading-none">{open ? "×" : "≡"}</span>
            </button>
          </div>
        </div>

        {/* ---------------------------------------------- 3. ana gezinme */}
        <nav className="hidden border-t border-line lg:block">
          <div className="u-wrap flex h-[46px] items-center justify-center gap-1">
            {NAV.map((n) => {
              const active = path.startsWith(n.match);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`relative px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors after:absolute after:bottom-0 after:left-4 after:right-4 after:h-[2px] after:origin-left after:scale-x-0 after:bg-accent after:transition-transform hover:after:scale-x-100 ${
                    active ? "text-accent after:scale-x-100" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {open && (
          <nav className="border-t border-line bg-surface lg:hidden">
            <div className="u-wrap flex flex-col py-3">
              <form onSubmit={onSearch} role="search" className="mb-2 flex border border-line-strong bg-bg">
                <input
                  name="q"
                  type="search"
                  placeholder="Ürün ara…"
                  aria-label="Ürün ara"
                  className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
                />
                <button type="submit" aria-label="Ara" className="px-4 text-[16px] text-muted">
                  ⌕
                </button>
              </form>

              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-line py-3.5 text-[15px] font-medium last:border-0"
                >
                  {n.label}
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                </Link>
              ))}
              <a
                href={`tel:${phoneRaw}`}
                className="py-3.5 text-[15px] font-semibold text-accent"
              >
                {phone}
              </a>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
