import type { Metadata } from "next";
import CatalogBrowser from "@/components/CatalogBrowser";
import { PageHeader } from "@/components/brand/PageHeader";
import type { Filters } from "@/lib/product-types";
import {
  getPublishedProducts,
  getStoreCategories,
  getStoreColors,
  getStoreSectors,
} from "@/lib/storefront";

export const metadata: Metadata = {
  title: "Ürün Kataloğu",
  description:
    "İş montu, iş pantolonu, ikaz yeleği, üniforma ve promosyon ürünleri. Kategori, sektör ve renge göre filtreleyin.",
};

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };

  const initial: Filters = {
    world: one("world"),
    category: one("category"),
    sector: one("sector"),
    color: one("color"),
    q: one("q"),
  };

  return (
    <>
      <PageHeader eyebrow="Katalog" title="Ürün Kataloğu">
        Kurumsal ve endüstriyel iş kıyafetleri ile promosyon ürünleri. Tüm ürünler logo
        nakışı veya baskısı ile firmanıza özel üretilebilir.
      </PageHeader>

      <CatalogBrowser
        products={getPublishedProducts()}
        categories={getStoreCategories()}
        sectors={getStoreSectors()}
        colors={getStoreColors()}
        initial={initial}
      />
    </>
  );
}
