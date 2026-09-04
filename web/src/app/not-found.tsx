import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { QuoteProvider } from "@/lib/quote-store";
import { brand } from "@/lib/catalog";

/**
 * Genel 404. Kok yerlesim vitrin parcalarini artik yuklemedigi icin baslik,
 * altbilgi ve teklif sepeti saglayicisi burada dogrudan cagrilir.
 */
export default function NotFound() {
  return (
    <QuoteProvider>
      <Header phone={brand.phone} phoneRaw={brand.phoneRaw} />
      <main className="u-wrap py-24">
        <h1 className="text-[clamp(32px,5vw,52px)] font-bold uppercase">Sayfa bulunamadı</h1>
        <p className="mt-3 max-w-[50ch] text-[16px] text-ink-2">
          Aradığınız sayfa taşınmış veya kaldırılmış olabilir.
        </p>
        <Link href="/urunler" className="u-btn u-btn-primary mt-6">
          Ürün kataloğuna dön
        </Link>
      </main>
      <Footer brand={brand} />
    </QuoteProvider>
  );
}
