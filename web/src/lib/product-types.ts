/* ---------------------------------------------------------------------------
 * Vitrin urun tipleri.
 *
 * Ayri bir dosyada duruyorlar cunku istemci bilesenleri de bu tipleri
 * kullaniyor; storefront.ts "server-only" isaretli oldugu icin oradan
 * import edilemezler.
 * ------------------------------------------------------------------------ */

export type StoreColor = {
  id: string;
  name: string;
  hex: string;
  secondary: { id: string; name: string; hex: string } | null;
  label: string;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  catalogTitle: string | null;
  category: string | null;
  categoryName: string;
  subcategory: string | null;
  sectors: string[];
  colors: StoreColor[];
  images: string[];
  sizes: string[];
  sku: string | null;
  sourcePage: number | null;
  description: string | null;
  fabricType: string | null;
  fabricContent: string | null;
  features: string[];
  /** Vitrinde "kumas" satirinda gosterilen ozet. */
  fabrics: string[];
  priceMinor: number | null;
  wholesaleMinor: number | null;
  wholesaleMinQty: number | null;
  currency: string;
  moq: number | null;
  moqUnit: string | null;
  stock: number;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: number;
};

export type StoreCategory = {
  id: string;
  name: string;
  world: string;
  parentId: string | null;
};

export type StoreSector = { id: string; name: string };
export type StoreColorRef = { id: string; name: string; hex: string };

export type Filters = {
  world?: string;
  category?: string;
  sector?: string;
  color?: string;
  q?: string;
};
