import type {
  Filters,
  StoreCategory,
  StoreProduct,
  StoreSector,
} from "./product-types";

/* ---------------------------------------------------------------------------
 * Katalog filtresi.
 *
 * Saf fonksiyon: kategori ve sektor adlarini disaridan aldigi icin hem
 * sunucuda hem istemcide ayni sonucu verir.
 * ------------------------------------------------------------------------ */

export type CatalogIndex = {
  worldOf: (categoryId: string | null) => string;
  categoryName: (categoryId: string | null) => string;
  sectorName: (sectorId: string) => string;
};

export function makeCatalogIndex(
  categories: StoreCategory[],
  sectors: StoreSector[],
): CatalogIndex {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const sectorById = new Map(sectors.map((s) => [s.id, s]));
  return {
    worldOf: (id) => (id ? (catById.get(id)?.world ?? "is-kiyafetleri") : "is-kiyafetleri"),
    categoryName: (id) => (id ? (catById.get(id)?.name ?? id) : "—"),
    sectorName: (id) => sectorById.get(id)?.name ?? id,
  };
}

export function filterProducts(
  all: StoreProduct[],
  f: Filters,
  index: CatalogIndex,
): StoreProduct[] {
  const q = f.q?.trim().toLocaleLowerCase("tr");
  return all.filter((p) => {
    if (f.world && index.worldOf(p.category) !== f.world) return false;
    if (f.category && p.category !== f.category && p.subcategory !== f.category) return false;
    if (f.sector && !p.sectors.includes(f.sector)) return false;
    if (f.color && !p.colors.some((c) => c.id === f.color || c.secondary?.id === f.color))
      return false;
    if (q) {
      const hay = [
        p.name,
        p.catalogTitle ?? "",
        p.sku ?? "",
        index.categoryName(p.category),
        ...p.fabrics,
        ...p.colors.map((c) => c.name),
        ...p.sectors.map(index.sectorName),
      ]
        .join(" ")
        .toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Kategori basina yayindaki urun sayisi. */
export function categoryCounts(all: StoreProduct[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of all) {
    for (const key of [p.category, p.subcategory]) {
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
  }
  return m;
}
