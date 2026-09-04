import "server-only";

import { and, asc, count, desc, eq, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  colors,
  productColors,
  productImages,
  productSectors,
  productSizes,
  productVariants,
  products,
  sizes,
} from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Urun listeleme ve okuma sorgulari.
 *
 * Liste her zaman sunucuda filtrelenir, siralanir ve sayfalanir. Tum satirlari
 * cekip JavaScript'te suzmek 100.000 urunde calismaz; bu yuzden hicbir yerde
 * "tumunu getir sonra filtrele" yapilmaz.
 * ------------------------------------------------------------------------ */

export const PAGE_SIZE = 25;

export type ProductQuery = {
  q?: string;
  status?: string;
  category?: string;
  gender?: string;
  stock?: string;
  featured?: string;
  sort?: string;
  dir?: string;
  page?: number;
  lowStockThreshold?: number;
};

const SORTABLE = {
  name: products.name,
  sku: products.sku,
  price: products.priceMinor,
  stock: products.stock,
  status: products.status,
  updated: products.updatedAt,
} as const;

function whereFor(q: ProductQuery): SQL | undefined {
  const parts: (SQL | undefined)[] = [];

  // Arsivlenmisler ancak acikca istendiginde gelir.
  parts.push(isNull(products.deletedAt));
  if (q.status) parts.push(eq(products.status, q.status));
  else parts.push(sql`${products.status} <> 'archived'`);

  if (q.category) {
    parts.push(
      or(eq(products.categoryId, q.category), eq(products.subcategoryId, q.category)),
    );
  }
  if (q.gender) parts.push(eq(products.gender, q.gender));
  if (q.featured === "1") parts.push(eq(products.featured, true));

  if (q.stock === "out") parts.push(eq(products.stock, 0));
  else if (q.stock === "low") parts.push(lt(products.stock, q.lowStockThreshold ?? 20));

  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${products.name})`, pattern),
        like(sql`lower(${products.sku})`, pattern),
        like(sql`lower(${products.slug})`, pattern),
        like(sql`lower(${products.catalogTitle})`, pattern),
      ),
    );
  }

  return and(...parts.filter(Boolean));
}

export type ProductListRow = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  status: string;
  featured: boolean;
  stock: number;
  priceMinor: number | null;
  wholesaleMinor: number | null;
  currency: string;
  updatedAt: number;
  categoryName: string | null;
  image: string | null;
  variantCount: number;
};

export function listProducts(q: ProductQuery): {
  rows: ProductListRow[];
  total: number;
  page: number;
} {
  const where = whereFor(q);
  const page = Math.max(1, q.page ?? 1);

  const total = db.select({ n: count() }).from(products).where(where).get()?.n ?? 0;

  const column = SORTABLE[(q.sort ?? "updated") as keyof typeof SORTABLE] ?? products.updatedAt;
  const direction = q.dir === "asc" ? asc : desc;

  // Ana gorsel ve varyant sayisi iliskili alt sorgulardan gelir; N+1 yok.
  const primaryImage = sql<string | null>`(
    SELECT url FROM ${productImages}
    WHERE ${productImages.productId} = ${products.id}
    ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC
    LIMIT 1
  )`;
  const variantCount = sql<number>`(
    SELECT COUNT(*) FROM ${productVariants}
    WHERE ${productVariants.productId} = ${products.id}
      AND ${productVariants.deletedAt} IS NULL
  )`;

  const rows = db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      name: products.name,
      status: products.status,
      featured: products.featured,
      stock: products.stock,
      priceMinor: products.priceMinor,
      wholesaleMinor: products.wholesaleMinor,
      currency: products.currency,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      image: primaryImage,
      variantCount,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(direction(column), asc(products.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { rows, total, page };
}

/** Duzenleme ekraninin ihtiyaci olan her sey tek cagrida. */
export function getProductDetail(id: string) {
  const product = db.select().from(products).where(eq(products.id, id)).get();
  if (!product) return null;

  const images = db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder))
    .all();

  const chosenColors = db
    .select({
      colorId: productColors.colorId,
      label: productColors.label,
      secondaryColorId: productColors.secondaryColorId,
      sortOrder: productColors.sortOrder,
      name: colors.name,
      hex: colors.hex,
    })
    .from(productColors)
    .innerJoin(colors, eq(colors.id, productColors.colorId))
    .where(eq(productColors.productId, id))
    .orderBy(asc(productColors.sortOrder))
    .all();

  const chosenSizes = db
    .select({ sizeId: productSizes.sizeId, name: sizes.name, sortOrder: sizes.sortOrder })
    .from(productSizes)
    .innerJoin(sizes, eq(sizes.id, productSizes.sizeId))
    .where(eq(productSizes.productId, id))
    .orderBy(asc(sizes.sortOrder))
    .all();

  const chosenSectors = db
    .select({ sectorId: productSectors.sectorId })
    .from(productSectors)
    .where(eq(productSectors.productId, id))
    .all();

  const variants = db
    .select({
      id: productVariants.id,
      colorId: productVariants.colorId,
      sizeId: productVariants.sizeId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      stock: productVariants.stock,
      priceMinor: productVariants.priceMinor,
      status: productVariants.status,
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
    .all();

  return {
    product,
    images,
    colors: chosenColors,
    sizes: chosenSizes,
    sectorIds: chosenSectors.map((s) => s.sectorId),
    variants,
  };
}

export type ProductDetail = NonNullable<ReturnType<typeof getProductDetail>>;

/** Form acilis listeleri: kategoriler, renkler, bedenler, sektorler. */
export function getFormOptions() {
  const categoryRows = db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      world: categories.world,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  return {
    categories: categoryRows,
    colors: db.select().from(colors).orderBy(asc(colors.sortOrder)).all(),
    sizes: db.select().from(sizes).orderBy(asc(sizes.sortOrder)).all(),
  };
}

/** Ust kategori adiyla birlikte gosterim etiketi ("Üst Giyim › Polar Mont"). */
export function categoryLabels(
  rows: { id: string; name: string; parentId: string | null }[],
): { id: string; label: string; depth: number }[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .map((r) => {
      const parent = r.parentId ? byId.get(r.parentId) : null;
      return {
        id: r.id,
        label: parent ? `${parent.name} › ${r.name}` : r.name,
        depth: parent ? 1 : 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "tr"));
}
