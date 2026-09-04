import "server-only";

import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  colors,
  homeBanners,
  productColors,
  productImages,
  productSectors,
  productSizes,
  products,
  sectors,
  sizes,
} from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Vitrinin veri kaynagi.
 *
 * Site artik catalog.json'u degil veritabanini okuyor: panelde yapilan her
 * degisiklik (fiyat, durum, gorsel, kategori) dogrudan vitrine yansiyor.
 * catalog.json yalnizca ilk kurulum verisi olarak kaldi (npm run db:seed).
 *
 * Yalnizca "active" urunler yayindadir. Taslak, stokta yok ve arsiv durumundaki
 * kayitlar vitrinde hic gorunmez.
 *
 * Sorgular toplu calisir: urunler bir kez cekilir, renk/gorsel/sektor/beden
 * satirlari tek seferde alinip bellekte eslestirilir. Urun basina sorgu yok.
 * ------------------------------------------------------------------------ */

export type {
  StoreColor,
  StoreProduct,
  StoreCategory,
  StoreSector,
  StoreColorRef,
} from "./product-types";

import type {
  StoreCategory,
  StoreColorRef,
  StoreProduct,
  StoreSector,
} from "./product-types";

/** Yalnizca yayindaki urunler. */
const PUBLISHED = and(eq(products.status, "active"), isNull(products.deletedAt));

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Urun satirlarini iliskili verilerle birlestirir. */
function hydrate(rows: (typeof products.$inferSelect)[]): StoreProduct[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const imageRows = db
    .select({
      productId: productImages.productId,
      url: productImages.url,
      isPrimary: productImages.isPrimary,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .where(inArray(productImages.productId, ids))
    .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder))
    .all();

  const colorRows = db
    .select({
      productId: productColors.productId,
      label: productColors.label,
      sortOrder: productColors.sortOrder,
      id: colors.id,
      name: colors.name,
      hex: colors.hex,
      secondaryId: productColors.secondaryColorId,
    })
    .from(productColors)
    .innerJoin(colors, eq(colors.id, productColors.colorId))
    .where(inArray(productColors.productId, ids))
    .orderBy(asc(productColors.sortOrder))
    .all();

  // Ikincil renkler ayri bir sozlukten cozulur; join'i iki kez yapmaya gerek yok.
  const palette = new Map(
    db.select().from(colors).all().map((c) => [c.id, c]),
  );

  const sectorRows = db
    .select({ productId: productSectors.productId, sectorId: productSectors.sectorId })
    .from(productSectors)
    .where(inArray(productSectors.productId, ids))
    .all();

  const sizeRows = db
    .select({
      productId: productSizes.productId,
      name: sizes.name,
      sortOrder: sizes.sortOrder,
    })
    .from(productSizes)
    .innerJoin(sizes, eq(sizes.id, productSizes.sizeId))
    .where(inArray(productSizes.productId, ids))
    .orderBy(asc(sizes.sortOrder))
    .all();

  const byProduct = <T extends { productId: string }>(list: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of list) {
      const bucket = map.get(row.productId);
      if (bucket) bucket.push(row);
      else map.set(row.productId, [row]);
    }
    return map;
  };

  const categoryNames = new Map(
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .all()
      .map((c) => [c.id, c.name]),
  );

  const images = byProduct(imageRows);
  const colorsBy = byProduct(colorRows);
  const sectorsBy = byProduct(sectorRows);
  const sizesBy = byProduct(sizeRows);

  return rows.map((p) => {
    const features = parseList(p.features);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      catalogTitle: p.catalogTitle,
      category: p.categoryId,
      categoryName: p.categoryId ? (categoryNames.get(p.categoryId) ?? p.categoryId) : "—",
      subcategory: p.subcategoryId,
      sectors: (sectorsBy.get(p.id) ?? []).map((s) => s.sectorId),
      colors: (colorsBy.get(p.id) ?? []).map((c) => {
        const secondary = c.secondaryId ? palette.get(c.secondaryId) : undefined;
        return {
          id: c.id,
          name: c.name,
          hex: c.hex,
          secondary: secondary
            ? { id: secondary.id, name: secondary.name, hex: secondary.hex }
            : null,
          label: c.label ?? c.name,
        };
      }),
      images: (images.get(p.id) ?? []).map((i) => i.url),
      sizes: (sizesBy.get(p.id) ?? []).map((s) => s.name),
      sku: p.sku,
      sourcePage: p.sourcePage,
      description: p.description,
      fabricType: p.fabricType,
      fabricContent: p.fabricContent,
      features,
      // Kumas satiri: once acik kumas turu, yoksa ozellik listesi kullanilir.
      fabrics: p.fabricType ? [p.fabricType] : features,
      priceMinor: p.priceMinor,
      wholesaleMinor: p.wholesaleMinor,
      wholesaleMinQty: p.wholesaleMinQty,
      currency: p.currency,
      moq: p.moq,
      moqUnit: p.moqUnit,
      stock: p.stock,
      featured: p.featured,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      createdAt: p.createdAt,
    };
  });
}

export function getPublishedProducts(): StoreProduct[] {
  const rows = db
    .select()
    .from(products)
    .where(PUBLISHED)
    .orderBy(asc(products.name))
    .all();
  return hydrate(rows);
}

export function getPublishedProduct(slug: string): StoreProduct | null {
  const row = db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), PUBLISHED))
    .get();
  return row ? (hydrate([row])[0] ?? null) : null;
}

/**
 * Ana sayfadaki secki.
 *
 * Once panelde "one cikar" isaretlenenler, sonra en yeni eklenenler gelir.
 * Yeni yayinlanan bir urunun ana sayfada hemen gorunmesi beklenen davranis;
 * daha once gorsel sayisina gore siralaniyordu ve yeni urun listenin sonuna
 * dusup hic gorunmuyordu.
 */
export function getFeaturedProducts(n = 8): StoreProduct[] {
  const all = getPublishedProducts();
  const marked = all.filter((p) => p.featured);
  if (marked.length >= n) {
    return marked.sort((a, b) => b.createdAt - a.createdAt).slice(0, n);
  }

  const rest = all
    .filter((p) => !p.featured)
    .sort((a, b) => b.createdAt - a.createdAt);
  return [...marked, ...rest].slice(0, n);
}

export function getStoreCategories(): StoreCategory[] {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      world: categories.world,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(and(isNull(categories.deletedAt), ne(categories.status, "archived")))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function getStoreSectors(): StoreSector[] {
  return db
    .select({ id: sectors.id, name: sectors.name })
    .from(sectors)
    .orderBy(asc(sectors.sortOrder))
    .all();
}

export function getStoreColors(): StoreColorRef[] {
  return db
    .select({ id: colors.id, name: colors.name, hex: colors.hex })
    .from(colors)
    .orderBy(asc(colors.sortOrder))
    .all();
}

/* ---------------------------------------------------------------------------
 * Ana sayfa gorselleri.
 * Panelden yonetilir (/admin/banner); yalnizca "active" olanlar yayindadir.
 * ------------------------------------------------------------------------ */

export type HomeBanner = {
  id: string;
  imageUrl: string;
  focus: string | null;
  eyebrow: string | null;
  title: string | null;
  accentTitle: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  cta2Label: string | null;
  cta2Href: string | null;
};

function bannersOfKind(kind: "slide" | "card"): HomeBanner[] {
  return db
    .select()
    .from(homeBanners)
    .where(and(eq(homeBanners.kind, kind), eq(homeBanners.status, "active")))
    .orderBy(asc(homeBanners.sortOrder))
    .all()
    // Gorseli olmayan kayit sayfada bos bir kutu birakirdi.
    .filter((r) => Boolean(r.imageUrl))
    .map((r) => ({
      id: r.id,
      imageUrl: r.imageUrl!,
      focus: r.focus,
      eyebrow: r.eyebrow,
      title: r.title,
      accentTitle: r.accentTitle,
      subtitle: r.subtitle,
      ctaLabel: r.ctaLabel,
      ctaHref: r.ctaHref,
      cta2Label: r.cta2Label,
      cta2Href: r.cta2Href,
    }));
}

export function getHomeSlides(): HomeBanner[] {
  return bannersOfKind("slide");
}

export function getHomeCards(): HomeBanner[] {
  return bannersOfKind("card");
}

/** Ayni kategoriden, kendisi haric, en fazla n urun. */
export function getRelatedProducts(product: StoreProduct, n = 4): StoreProduct[] {
  if (!product.category) return [];
  const rows = db
    .select()
    .from(products)
    .where(and(eq(products.categoryId, product.category), PUBLISHED))
    .orderBy(asc(products.name))
    .all()
    .filter((p) => p.id !== product.id)
    .slice(0, n);
  return hydrate(rows);
}
