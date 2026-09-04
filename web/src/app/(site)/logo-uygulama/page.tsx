import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/brand/PageHeader";
import { brand } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Logo Nakış ve Baskı",
  description:
    "İş kıyafetlerine logo nakışı ve baskı uygulaması. Firmanıza özel üretim.",
};

export default function LogoPage() {
  return (
    <>
      <PageHeader eyebrow="Hizmet" title="Logo nakış ve baskı">
        Kataloğumuzdaki tüm ürünler firmanızın logosuyla üretilebilir. Sattığımız şey
        yalnızca kıyafet değil, personelinizin kurumsal görünümü.
      </PageHeader>

      <div className="u-wrap py-14">
      {/* Bu hizmetin ticari detaylari (yontem, ucret, minimum adet, sure)
          firmadan alinmadi. Uydurmak yerine acikca belirtiliyor. */}
      <div className="max-w-[62ch] border-l-2 border-warn bg-surface p-5">
        <h2 className="text-[20px] font-semibold">Bu sayfa tamamlanmayı bekliyor</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Nakış ve baskı seçenekleri, uygulama bölgeleri, renk sayısına göre ücret,
          minimum adet ve teslim süresi bilgileri firmadan alınmadı. Bu bilgiler
          uydurulmadı; geldiğinde bu sayfa gerçek içerikle doldurulacak.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/teklif" className="u-btn u-btn-primary">
          Teklif Al
        </Link>
        <a href={`tel:${brand.phoneRaw}`} className="u-btn u-btn-ghost">
          {brand.phone}
        </a>
      </div>
      </div>
    </>
  );
}
