import type { Metadata } from "next";
import Link from "next/link";
import { count, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, productImages, products } from "@/db/schema";
import { brand, GAP_LABEL, type DataGap } from "@/lib/catalog";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Veri Durumu",
  robots: { index: false, follow: false },
};

/* ---------------------------------------------------------------------------
 * Katalogdan cikarilamayan alanlarin takibi.
 *
 * Kaynak artik catalog.json degil veritabani: panelden bir urune fiyat
 * girildiginde bu sayfadaki eksik sayisi da duser.
 * ------------------------------------------------------------------------ */

const ALL_GAPS: DataGap[] = [
  "sku",
  "fiyat",
  "beden",
  "stok",
  "moq",
  "renk",
  "sertifika",
  "urun-ayrimi",
];

export default async function DataStatusPage() {
  await requirePermission("product.read");

  const total = db.select({ n: count() }).from(products).where(isNull(products.deletedAt)).get()!.n;
  const priced =
    db
      .select({ n: count() })
      .from(products)
      .where(isNotNull(products.priceMinor))
      .get()?.n ?? 0;
  const images = db.select({ n: count() }).from(productImages).get()?.n ?? 0;

  // dataGaps JSON dizisi; SQLite'ta LIKE ile saymak 100k satirda da yeterli hizli.
  const gapCounts = new Map<DataGap, number>();
  for (const gap of ALL_GAPS) {
    const row = db
      .select({ n: count() })
      .from(products)
      .where(sql`${products.dataGaps} LIKE ${`%"${gap}"%`} AND ${products.deletedAt} IS NULL`)
      .get();
    gapCounts.set(gap, row?.n ?? 0);
  }

  const needsSplit = db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      sourcePage: products.sourcePage,
      features: products.features,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(sql`${products.dataGaps} LIKE '%"urun-ayrimi"%' AND ${products.deletedAt} IS NULL`)
    .all();

  return (
    <div className="mx-auto max-w-[1000px]">
      <span className="u-eyebrow">İç kullanım</span>
      <h1 className="mt-2 text-[30px] font-bold uppercase">Veri Durumu</h1>
      <p className="mt-3 max-w-[70ch] text-[14px] text-ink-2">
        Ürünler katalogdan çıkarılabilen veriyle kuruldu: ad, kategori, renk ve görsel.
        Aşağıdaki alanlar firmadan gelmeden ürün sayfaları eksik kalır. Hiçbiri varsayılan
        değerle doldurulmadı; panelden girildikçe bu sayılar düşer.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        <Stat value={total.toLocaleString("tr")} label="ürün kaydı" />
        <Stat value={images.toLocaleString("tr")} label="görsel" />
        <Stat
          value={needsSplit.length.toLocaleString("tr")}
          label="bölünmesi gereken kayıt"
          tone={needsSplit.length > 0 ? "warn" : undefined}
        />
        <Stat
          value={`${priced} / ${total}`}
          label="fiyatı girilmiş ürün"
          tone={priced === 0 ? "bad" : undefined}
        />
      </div>

      <h2 className="mt-12 text-[22px] font-semibold uppercase">Eksik alanlar</h2>
      <div className="a-card mt-4 overflow-x-auto">
        <table className="a-table min-w-[520px]">
          <thead>
            <tr>
              <th>Alan</th>
              <th className="text-right">Eksik ürün</th>
              <th>Kapsam</th>
            </tr>
          </thead>
          <tbody>
            {ALL_GAPS.map((g) => {
              const n = gapCounts.get(g) ?? 0;
              const pct = total === 0 ? 0 : Math.round((n / total) * 100);
              return (
                <tr key={g}>
                  <td className="font-semibold">{GAP_LABEL[g]}</td>
                  <td className="text-right tabular-nums">
                    {n} / {total}
                  </td>
                  <td>
                    <div className="h-2 w-full max-w-[260px] bg-surface-2">
                      <div
                        className={pct > 60 ? "h-full bg-accent" : "h-full bg-warn"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {needsSplit.length > 0 ? (
        <>
          <h2 className="mt-12 text-[22px] font-semibold uppercase">
            Tek başlık, birden çok ürün
          </h2>
          <p className="mt-2 max-w-[70ch] text-[14px] text-ink-2">
            Bu kayıtlar katalogda tek başlık altında toplanmış ama birden fazla ürün
            içeriyor. Ayrı ürün mü, aynı ürünün kumaş seçeneği mi olduğu netleşince
            bölünmeli.
          </p>
          <ul className="mt-4 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {needsSplit.map((p) => (
              <li key={p.id} className="bg-bg p-4">
                <Link
                  href={`/admin/urunler/${p.id}`}
                  className="font-semibold hover:text-accent"
                >
                  {p.name}
                </Link>
                <p className="text-[12px] text-muted">
                  {p.categoryName ?? "—"} · katalog s. {p.sourcePage ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="mt-12 text-[22px] font-semibold uppercase">Firma bilgileri</h2>
      <p className="mt-2 text-[14px] text-ink-2">
        Katalogdan alınanlar: {brand.owner}, {brand.phone}, {brand.email}, {brand.address}
      </p>
      <p className="mt-2 text-[14px] text-warn">
        Eksik ve yayın öncesi zorunlu: {brand.missing.join(", ")}.
      </p>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="bg-bg p-4">
      <div
        className={`font-display text-3xl font-bold tabular-nums ${
          tone === "bad" ? "text-accent" : tone === "warn" ? "text-warn" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-[13px] leading-tight text-muted">{label}</div>
    </div>
  );
}
