import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { QuoteProvider } from "@/lib/quote-store";
import { brand } from "@/lib/catalog";

/** Vitrin yerlesimi: baslik, altbilgi ve teklif sepeti yalnizca burada yaslanir. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuoteProvider>
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        İçeriğe geç
      </a>
      <Header phone={brand.phone} phoneRaw={brand.phoneRaw} />
      <main id="icerik">{children}</main>
      <Footer brand={brand} />
    </QuoteProvider>
  );
}
