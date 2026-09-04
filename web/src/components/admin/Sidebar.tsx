"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = {
  href: string;
  label: string;
  /** Sayi rozeti: bekleyen basvuru, yeni teklif gibi is yigini. */
  badge?: number;
};

export type NavSection = { title: string; items: NavItem[] };

/* ---------------------------------------------------------------------------
 * Sol gezinme.
 *
 * Hangi baglantilarin gorunecegine sunucu karar verir (izinlere gore); burada
 * yalnizca aktif durum ve mobil ac/kapa mantigi vardir. Menude bir baglantinin
 * gorunmesi yetki anlamina gelmez, her istek sunucuda yeniden dogrulanir.
 * ------------------------------------------------------------------------ */

export function Sidebar({
  sections,
  userName,
  roleLabel,
}: {
  sections: NavSection[];
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Gezinme sonrasi mobil menuyu kapat.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        className="a-btn a-btn-ghost fixed left-3 top-3 z-40 md:hidden"
        aria-expanded={open}
        aria-controls="admin-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Kapat" : "Menü"}
      </button>

      <aside
        id="admin-nav"
        className={`z-30 flex flex-col bg-[#14171a] pb-6 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[236px] max-md:overflow-y-auto max-md:shadow-2xl ${
          open ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        } transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0`}
      >
        <div className="border-b border-white/10 px-4 py-5">
          <Link href="/admin" className="block">
            <span className="font-display text-[22px] font-bold uppercase tracking-tight text-white">
              Sima
            </span>
            <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Yönetim
            </span>
          </Link>
          <p className="mt-2 truncate text-[12px] text-[#8b9299]">
            {userName} · {roleLabel}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7278]">
                {section.title}
              </p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="a-nav-link"
                  data-active={isActive(pathname, item.href)}
                >
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="min-w-[20px] bg-accent px-1.5 text-center text-[11px] font-semibold leading-[18px] text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <Link
          href="/"
          className="mx-4 mt-auto border border-white/15 px-3 py-2 text-center text-[12px] font-semibold text-[#c3c8cd] hover:border-white/40 hover:text-white"
        >
          Siteyi görüntüle →
        </Link>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}
    </>
  );
}

/** /admin yalnizca tam eslesmede aktif; digerleri alt yollarini da kapsar. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
