import type { Metadata } from "next";
import { PageHeader } from "@/components/brand/PageHeader";
import { brand } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "İletişim",
  description: `${brand.name} — ${brand.address}. Telefon: ${brand.phone}`,
};

export default function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="İletişim" title="Bize ulaşın">
        Kumaş, gramaj, adet ve teslim süresi için doğrudan arayın ya da teklif listenizi
        gönderin.
      </PageHeader>

      <div className="u-wrap grid gap-10 py-14 md:grid-cols-2">
        <dl className="divide-y divide-line border-y border-line text-[15px]">
          <Row label="Yetkili">
            {brand.owner} — {brand.ownerTitle}
          </Row>
          <Row label="Telefon">
            <a href={`tel:${brand.phoneRaw}`} className="font-semibold hover:text-accent">
              {brand.phone}
            </a>
          </Row>
          <Row label="E-posta">
            <a href={`mailto:${brand.email}`} className="hover:text-accent">
              {brand.email}
            </a>
          </Row>
          <Row label="Instagram">
            <a
              href={`https://instagram.com/${brand.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              @{brand.instagram}
            </a>
          </Row>
          <Row label="Adres">{brand.address}</Row>
        </dl>

        <div className="h-fit border border-line bg-surface p-7">
          <h2 className="font-display text-[26px] font-semibold uppercase">
            Teklif mi istiyorsunuz?
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Ürün listenizi hazırlayıp gönderin, aynı gün dönüş yapalım.
          </p>
          <a href="/teklif" className="u-btn u-btn-primary mt-5">
            Teklif Al
          </a>
          <p className="mt-6 border-t border-line pt-4 text-[13px] text-warn">
            Ticari unvan, vergi dairesi ve numarası ile kurumsal e-posta adresi
            eklendiğinde bu sayfa güncellenecek.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 py-4">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
