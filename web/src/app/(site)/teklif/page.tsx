import type { Metadata } from "next";
import QuoteRequest from "@/components/QuoteRequest";
import { PageHeader } from "@/components/brand/PageHeader";
import { brand } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Teklif Al",
  description:
    "Personel sayınızı ve ürünlerinizi girin, toptan teklifinizi hazırlayalım.",
  robots: { index: false },
};

export default function QuotePage() {
  return (
    <>
      <PageHeader eyebrow="Teklif" title="Toptan Teklif Al">
        Listenizi tamamlayın ve firma bilgilerinizi bırakın. Teklifiniz aynı gün içinde
        hazırlanıp e-posta ile gönderilir. Acil durumlar için{" "}
        <a href={`tel:${brand.phoneRaw}`} className="font-semibold text-accent">
          {brand.phone}
        </a>
        .
      </PageHeader>
      <QuoteRequest />
    </>
  );
}
