import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { brand } from "@/lib/catalog";
import "./globals.css";

/* ---------------------------------------------------------------------------
 * Kok yerlesim yalnizca belgeyi ve yazi tiplerini kurar.
 *
 * Baslik/altbilgi gibi vitrin parcalari (site) grubunun yerlesimindedir;
 * yonetim paneli (admin) kendi kabugunu kullanir ve vitrin bilesenlerinden
 * hicbirini yuklemez.
 * ------------------------------------------------------------------------ */

const sans = Barlow({
  subsets: ["latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const display = Barlow_Condensed({
  subsets: ["latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s | ${brand.name}`,
  },
  description:
    "Kurumsal ve endüstriyel iş kıyafetleri, ikaz yelekleri, üniformalar ve promosyon ürünleri. Personelinizi logonuzla giydiriyoruz.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: brand.name,
    images: [
      {
        url: "/brand/sima-banner.jpg",
        width: 1133,
        height: 944,
        alt: `${brand.name} logosu`,
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
