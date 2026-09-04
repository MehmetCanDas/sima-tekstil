"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  colors,
  productColors,
  productImages,
  productSectors,
  productSizes,
  productVariants,
  products,
  sizes,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { type ActionResult, fail, guard, ok } from "./action";
import { diff, logActivity } from "./log";
import { parseMoney, slugify } from "./format";
import { recomputeProductStock } from "./stock";
import { IMAGE_MIME_EXT, checkFiles } from "./upload-limits";

/* ---------------------------------------------------------------------------
 * Urun yazma islemleri.
 *
 * Her action'in ilk satiri requirePermission'dir: menude buton gizlemek
 * yetkilendirme sayilmaz, karar burada verilir. Coklu tablo yazan islemler
 * tek transaction icinde calisir; yarim kalmis urun olusmaz.
 * ------------------------------------------------------------------------ */

const STATUSES = ["active", "draft", "out_of_stock", "archived"] as const;
const GENDERS = ["unisex", "kadin", "erkek", "cocuk"] as const;

const productSchema = z.object({
  name: z.string().trim().min(2, "Ürün adı en az 2 karakter.").max(200),
  slug: z.string().trim().max(120).optional(),
  sku: z.string().trim().max(60).optional(),
  categoryId: z.string().trim().optional(),
  subcategoryId: z.string().trim().optional(),
  gender: z.enum(GENDERS).default("unisex"),
  description: z.string().trim().max(8000).optional(),
  fabricType: z.string().trim().max(200).optional(),
  fabricContent: z.string().trim().max(400).optional(),
  features: z.string().max(4000).optional(),
  price: z.string().optional(),
  wholesale: z.string().optional(),
  wholesaleMinQty: z.string().optional(),
  currency: z.string().trim().length(3).default("TRY"),
  moq: z.string().optional(),
  moqUnit: z.string().trim().max(30).optional(),
  stock: z.string().optional(),
  status: z.enum(STATUSES).default("draft"),
  featured: z.string().optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
});

type ProductInput = z.infer<typeof productSchema>;

function readForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return productSchema.safeParse(raw);
}

function intOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Formdaki serbest degerleri veritabani satirina cevirir. */
function toRow(input: ProductInput) {
  return {
    name: input.name,
    sku: input.sku || null,
    categoryId: input.categoryId || null,
    subcategoryId: input.subcategoryId || null,
    gender: input.gender,
    description: input.description || null,
    fabricType: input.fabricType || null,
    fabricContent: input.fabricContent || null,
    features: JSON.stringify(
      (input.features ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    ),
    priceMinor: parseMoney(input.price),
    wholesaleMinor: parseMoney(input.wholesale),
    wholesaleMinQty: intOrNull(input.wholesaleMinQty),
    currency: input.currency.toUpperCase(),
    moq: intOrNull(input.moq),
    moqUnit: input.moqUnit || null,
    status: input.status,
    featured: input.featured === "on" || input.featured === "1",
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    updatedAt: Date.now(),
  };
}

/**
 * Toptan fiyat ile adet esigi birlikte anlam kazanir:
 *  - esiksiz toptan fiyat hicbir siparise uygulanmaz,
 *  - fiyatsiz esik de bir sey ifade etmez.
 * Bu yuzden biri girildiginde digeri zorunludur.
 */
function checkWholesaleTier(input: ProductInput): ActionResult<never> | null {
  const price = parseMoney(input.wholesale);
  const minQty = intOrNull(input.wholesaleMinQty);

  if (price !== null && (minQty === null || minQty < 2)) {
    return fail("Toptan fiyat için adet sınırı gerekli.", {
      wholesaleMinQty:
        "Toptan fiyatın kaç adetten sonra geçerli olacağını girin (en az 2).",
    });
  }
  if (price === null && minQty !== null) {
    return fail("Adet sınırı için toptan fiyat gerekli.", {
      wholesale: "Bu sınırda uygulanacak toptan fiyatı girin.",
    });
  }
  if (price !== null && input.price && parseMoney(input.price) !== null) {
    const list = parseMoney(input.price)!;
    if (price >= list) {
      return fail("Toptan fiyat liste fiyatından düşük olmalı.", {
        wholesale: "Toptan fiyat, liste fiyatının altında olmalı.",
      });
    }
  }
  return null;
}

/**
 * Vitrin sayfalari veritabanindan okudugu icin urun degisince onlarin da
 * onbellegi dusurulur; aksi halde panelde gorunen ile sitede gorunen ayrisir.
 */
function revalidateStorefront(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/urunler");
  if (slug) revalidatePath(`/urun/${slug}`);
}

/** Slug cakisirsa sonuna -2, -3 ... ekler. */
function uniqueSlug(base: string, exceptId?: string): string {
  const root = slugify(base) || `urun-${Date.now()}`;
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    const hit = db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .get();
    if (!hit || hit.id === exceptId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

/* ------------------------------ olustur -------------------------------- */

export async function createProductAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.create");
    const parsed = readForm(formData);
    if (!parsed.success) {
      const { fieldErrorsOf } = await import("./action");
      return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));
    }

    const input = parsed.data;
    const tierProblem = checkWholesaleTier(input);
    if (tierProblem) return tierProblem;

    const id = randomUUID();
    const row = toRow(input);
    const slug = uniqueSlug(input.slug || input.name);

    db.insert(products)
      .values({
        id,
        slug,
        stock: intOrNull(input.stock) ?? 0,
        dataGaps: "[]",
        ...row,
      })
      .run();

    // Gorseller urun kaydi olustuktan sonra yazilir: dosya yolu urun kimligini
    // icerdigi icin once kaydin var olmasi gerekir.
    const files = filesFrom(formData);
    const upload = await storeProductImages(id, input.name, files);

    await logActivity({
      actor,
      action: "product.create",
      entityType: "product",
      entityId: id,
      entityLabel: input.name,
      after: { name: input.name, slug, status: input.status, images: upload.saved },
    });

    revalidatePath("/admin/urunler");
    revalidateStorefront(slug);

    if (upload.error) {
      // Urun olustu ama gorsellerin bir kismi yazilamadi; kullanici duzenleme
      // ekraninda uyariyi gorsun diye yonlendirme yerine mesaj doner.
      return fail(
        `Ürün oluşturuldu fakat görsellerde sorun var: ${upload.error} Görselleri ürün sayfasından ekleyebilirsiniz.`,
      );
    }

    redirect(`/admin/urunler/${id}?created=1`);
  });
}

/* ------------------------------ guncelle ------------------------------- */

export async function updateProductAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const id = String(formData.get("id") ?? "");
    const before = db.select().from(products).where(eq(products.id, id)).get();
    if (!before) return fail("Ürün bulunamadı.");

    const parsed = readForm(formData);
    if (!parsed.success) {
      const { fieldErrorsOf } = await import("./action");
      return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));
    }

    const input = parsed.data;
    const tierProblem = checkWholesaleTier(input);
    if (tierProblem) return tierProblem;

    const row = toRow(input);
    const slug = input.slug ? uniqueSlug(input.slug, id) : before.slug;

    // Varyanti olan urunde stok varyantlardan hesaplanir; form degeri yok sayilir.
    const variantTotal = db
      .select({ n: sql<number>`COUNT(*)` })
      .from(productVariants)
      .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
      .get();
    const stock =
      (variantTotal?.n ?? 0) > 0 ? before.stock : (intOrNull(input.stock) ?? before.stock);

    db.update(products)
      .set({ ...row, slug, stock })
      .where(eq(products.id, id))
      .run();

    const changed = diff(before as unknown as Record<string, unknown>, {
      ...row,
      slug,
      stock,
    });
    if (changed) {
      await logActivity({
        actor,
        action: "product.update",
        entityType: "product",
        entityId: id,
        entityLabel: input.name,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidatePath("/admin/urunler");
    revalidatePath(`/admin/urunler/${id}`);
    revalidateStorefront(slug);
    return ok(undefined, "Ürün güncellendi.");
  });
}

/* --------------------------- renk / beden ------------------------------ */

export async function setProductOptionsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const id = String(formData.get("id") ?? "");
    const product = db.select().from(products).where(eq(products.id, id)).get();
    if (!product) return fail("Ürün bulunamadı.");

    const colorIds = formData.getAll("colorId").map(String).filter(Boolean);
    const sizeIds = formData.getAll("sizeId").map(String).filter(Boolean);

    // Gecersiz kimlikler sessizce dusurulur; istemciden gelen listeye guvenilmez.
    const validColors = colorIds.length
      ? db
          .select({ id: colors.id })
          .from(colors)
          .where(inArray(colors.id, colorIds))
          .all()
          .map((c) => c.id)
      : [];
    const validSizes = sizeIds.length
      ? db
          .select({ id: sizes.id })
          .from(sizes)
          .where(inArray(sizes.id, sizeIds))
          .all()
          .map((s) => s.id)
      : [];

    db.transaction((tx) => {
      tx.delete(productColors).where(eq(productColors.productId, id)).run();
      tx.delete(productSizes).where(eq(productSizes.productId, id)).run();
      validColors.forEach((colorId, i) =>
        tx.insert(productColors).values({ productId: id, colorId, sortOrder: i }).run(),
      );
      validSizes.forEach((sizeId, i) =>
        tx.insert(productSizes).values({ productId: id, sizeId, sortOrder: i }).run(),
      );
    });

    await logActivity({
      actor,
      action: "product.options",
      entityType: "product",
      entityId: id,
      entityLabel: product.name,
      after: { colors: validColors.length, sizes: validSizes.length },
    });

    revalidatePath(`/admin/urunler/${id}`);
    return ok(undefined, "Renk ve beden seçenekleri kaydedildi.");
  });
}

/* ------------------------------ varyant -------------------------------- */

/** Secili renk x beden kombinasyonlarindan eksik varyantlari uretir. */
export async function generateVariantsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const id = String(formData.get("id") ?? "");
    const product = db.select().from(products).where(eq(products.id, id)).get();
    if (!product) return fail("Ürün bulunamadı.");

    const chosenColors = db
      .select({ id: productColors.colorId, name: colors.name })
      .from(productColors)
      .innerJoin(colors, eq(colors.id, productColors.colorId))
      .where(eq(productColors.productId, id))
      .orderBy(productColors.sortOrder)
      .all();
    const chosenSizes = db
      .select({ id: productSizes.sizeId, name: sizes.name })
      .from(productSizes)
      .innerJoin(sizes, eq(sizes.id, productSizes.sizeId))
      .where(eq(productSizes.productId, id))
      .orderBy(sizes.sortOrder)
      .all();

    if (chosenColors.length === 0 || chosenSizes.length === 0) {
      return fail("Önce en az bir renk ve bir beden seçin.");
    }

    const existing = db
      .select({ colorId: productVariants.colorId, sizeId: productVariants.sizeId })
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .all();
    const seen = new Set(existing.map((v) => `${v.colorId}|${v.sizeId}`));

    const base = (product.sku || slugify(product.name).toUpperCase().slice(0, 12) || "URUN")
      .toUpperCase()
      .replace(/\s+/g, "");

    let created = 0;
    db.transaction((tx) => {
      for (const color of chosenColors) {
        for (const size of chosenSizes) {
          if (seen.has(`${color.id}|${size.id}`)) continue;
          const sku = uniqueVariantSku(
            `${base}-${short(color.name)}-${short(size.name)}`,
          );
          tx.insert(productVariants)
            .values({
              id: randomUUID(),
              productId: id,
              colorId: color.id,
              sizeId: size.id,
              sku,
              stock: 0,
              status: "active",
            })
            .run();
          created++;
        }
      }
    });

    recomputeProductStock(id);

    await logActivity({
      actor,
      action: "product.variants_generate",
      entityType: "product",
      entityId: id,
      entityLabel: product.name,
      after: { created },
    });

    revalidatePath(`/admin/urunler/${id}`);
    return ok(
      undefined,
      created === 0 ? "Tüm kombinasyonlar zaten var." : `${created} varyant oluşturuldu.`,
    );
  });
}

const short = (value: string) =>
  slugify(value).replace(/-/g, "").toUpperCase().slice(0, 3) || "X";

function uniqueVariantSku(base: string): string {
  let candidate = base;
  for (let i = 2; i < 500; i++) {
    const hit = db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.sku, candidate))
      .get();
    if (!hit) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Varyant tablosunun tamamini tek gonderimde kaydeder. */
export async function saveVariantsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const productId = String(formData.get("id") ?? "");
    const product = db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) return fail("Ürün bulunamadı.");

    const ids = formData.getAll("variantId").map(String);
    const rows = db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)))
      .all();
    const known = new Map(rows.map((r) => [r.id, r]));

    const problems: Record<string, string> = {};
    const updates: { id: string; sku: string; stock: number; priceMinor: number | null; status: string }[] =
      [];

    for (const id of ids) {
      if (!known.has(id)) continue;
      const sku = String(formData.get(`sku_${id}`) ?? "").trim();
      if (sku.length < 1) {
        problems[`sku_${id}`] = "SKU boş olamaz.";
        continue;
      }
      const stock = Math.max(0, Math.floor(Number(formData.get(`stock_${id}`)) || 0));
      const priceMinor = parseMoney(String(formData.get(`price_${id}`) ?? ""));
      const status = formData.get(`status_${id}`) === "inactive" ? "inactive" : "active";
      updates.push({ id, sku, stock, priceMinor, status });
    }

    if (Object.keys(problems).length > 0) {
      return fail("Bazı varyantlar kaydedilemedi.", problems);
    }

    // Ayni SKU iki satirda kullanilamaz; veritabani kisiti zaten engeller ama
    // hatayi alan bazinda gostermek icin once burada yakalanir.
    const skuSeen = new Map<string, string>();
    for (const u of updates) {
      const dup = skuSeen.get(u.sku);
      if (dup) return fail("Aynı SKU birden fazla varyantta kullanılamaz.", {
        [`sku_${u.id}`]: "Bu SKU tabloda tekrar ediyor.",
      });
      skuSeen.set(u.sku, u.id);
    }

    db.transaction((tx) => {
      for (const u of updates) {
        tx.update(productVariants)
          .set({
            sku: u.sku,
            stock: u.stock,
            priceMinor: u.priceMinor,
            status: u.status,
            updatedAt: Date.now(),
          })
          .where(eq(productVariants.id, u.id))
          .run();
      }
    });

    recomputeProductStock(productId);

    await logActivity({
      actor,
      action: "product.variants_update",
      entityType: "product",
      entityId: productId,
      entityLabel: product.name,
      after: { updated: updates.length },
    });

    revalidatePath(`/admin/urunler/${productId}`);
    return ok(undefined, `${updates.length} varyant kaydedildi.`);
  });
}

export async function deleteVariantAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const variantId = String(formData.get("variantId") ?? "");
    const variant = db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .get();
    if (!variant) return fail("Varyant bulunamadı.");

    // Varyantlar siparis satirlarindan referans alinabildigi icin soft delete.
    db.update(productVariants)
      .set({ deletedAt: Date.now(), status: "inactive" })
      .where(eq(productVariants.id, variantId))
      .run();

    recomputeProductStock(variant.productId);

    await logActivity({
      actor,
      action: "product.variant_delete",
      entityType: "product",
      entityId: variant.productId,
      entityLabel: variant.sku,
      before: { sku: variant.sku, stock: variant.stock },
    });

    revalidatePath(`/admin/urunler/${variant.productId}`);
    return ok(undefined, "Varyant kaldırıldı.");
  });
}

/* ------------------------------ arsivle -------------------------------- */

export async function archiveProductAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.delete");
    const id = String(formData.get("id") ?? "");
    const product = db.select().from(products).where(eq(products.id, id)).get();
    if (!product) return fail("Ürün bulunamadı.");

    const restore = formData.get("restore") === "1";
    db.update(products)
      .set({
        status: restore ? "draft" : "archived",
        deletedAt: null,
        updatedAt: Date.now(),
      })
      .where(eq(products.id, id))
      .run();

    await logActivity({
      actor,
      action: restore ? "product.restore" : "product.archive",
      entityType: "product",
      entityId: id,
      entityLabel: product.name,
      before: { status: product.status },
      after: { status: restore ? "draft" : "archived" },
    });

    revalidatePath("/admin/urunler");
    revalidatePath(`/admin/urunler/${id}`);
    revalidateStorefront(product.slug);
    return ok(
      undefined,
      restore ? "Ürün arşivden çıkarıldı (taslak)." : "Ürün arşive alındı.",
    );
  });
}

/* ------------------------------- toplu --------------------------------- */

const BULK_OPS = [
  "status",
  "category",
  "price",
  "wholesale",
  "stock",
  "discount",
  "featured",
  "archive",
] as const;

export async function bulkProductAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    // Arsivleme butonu ayri bir alan gonderir; secim kutusundaki islemi ezer.
    const op =
      formData.get("archive") === "1" ? "archive" : String(formData.get("op") ?? "");
    if (!(BULK_OPS as readonly string[]).includes(op)) return fail("Geçersiz toplu işlem.");

    // Arsivleme silme yetkisi ister; digerleri guncelleme yetkisi.
    const actor = await requirePermission(op === "archive" ? "product.delete" : "product.update");

    const ids = formData.getAll("selected").map(String).filter(Boolean);
    if (ids.length === 0) return fail("Hiç ürün seçilmedi.");
    if (ids.length > 5000) return fail("Tek seferde en fazla 5000 ürün işlenebilir.");

    const value = String(formData.get("value") ?? "").trim();
    const now = Date.now();
    let patch: Record<string, unknown> | null = null;
    let expression: ReturnType<typeof sql> | null = null;
    let label = "";

    switch (op) {
      case "status": {
        if (!(STATUSES as readonly string[]).includes(value)) return fail("Geçersiz durum.");
        patch = { status: value };
        label = `durum → ${value}`;
        break;
      }
      case "category": {
        if (!value) return fail("Kategori seçin.");
        patch = { categoryId: value };
        label = "kategori değişikliği";
        break;
      }
      case "price":
      case "wholesale": {
        const minor = parseMoney(value);
        if (minor === null) return fail("Geçerli bir fiyat girin.");
        patch = op === "price" ? { priceMinor: minor } : { wholesaleMinor: minor };
        label = `${op === "price" ? "liste" : "toptan"} fiyat → ${value}`;
        break;
      }
      case "stock": {
        const n = intOrNull(value);
        if (n === null) return fail("Geçerli bir stok değeri girin.");
        patch = { stock: n };
        label = `stok → ${n}`;
        break;
      }
      case "discount": {
        const pct = Number(value);
        if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
          return fail("İndirim oranı 1 ile 99 arasında olmalı.");
        }
        // Fiyati olmayan urunler etkilenmez; NULL uzerinde carpim yapilmaz.
        expression = sql`
          UPDATE ${products}
          SET price_minor = CAST(price_minor * ${1 - pct / 100} AS INTEGER),
              updated_at = ${now}
          WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
            AND price_minor IS NOT NULL
        `;
        label = `%${pct} indirim`;
        break;
      }
      case "featured": {
        patch = { featured: value === "1" };
        label = value === "1" ? "öne çıkar" : "öne çıkarmayı kaldır";
        break;
      }
      case "archive": {
        patch = { status: "archived" };
        label = "arşive al";
        break;
      }
    }

    if (expression) {
      db.run(expression);
    } else if (patch) {
      db.update(products)
        .set({ ...patch, updatedAt: now })
        .where(inArray(products.id, ids))
        .run();
    }

    await logActivity({
      actor,
      action: `product.bulk_${op}`,
      entityType: "product",
      entityLabel: `${ids.length} ürün`,
      after: { ids: ids.slice(0, 50), count: ids.length, change: label },
    });

    revalidatePath("/admin/urunler");
    revalidateStorefront();
    return ok(undefined, `${ids.length} üründe ${label} uygulandı.`);
  });
}

/* ------------------------------ gorseller ------------------------------ */

export async function reorderImagesAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    await requirePermission("product.update");
    const productId = String(formData.get("id") ?? "");
    const order = formData.getAll("imageId").map(String);
    if (order.length === 0) return fail("Sıralanacak görsel yok.");

    const owned = new Set(
      db
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .all()
        .map((r) => r.id),
    );

    db.transaction((tx) => {
      order.forEach((imageId, i) => {
        if (!owned.has(imageId)) return;
        tx.update(productImages)
          .set({ sortOrder: i, isPrimary: i === 0 })
          .where(eq(productImages.id, imageId))
          .run();
      });
    });

    revalidatePath(`/admin/urunler/${productId}`);
    return ok(undefined, "Görsel sırası kaydedildi.");
  });
}

export async function deleteImageAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const imageId = String(formData.get("imageId") ?? "");
    const image = db.select().from(productImages).where(eq(productImages.id, imageId)).get();
    if (!image) return fail("Görsel bulunamadı.");

    db.delete(productImages).where(eq(productImages.id, imageId)).run();

    // Ana gorsel silindiyse siradaki gorsel ana gorsel olur.
    const next = db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, image.productId))
      .orderBy(productImages.sortOrder)
      .get();
    if (next) {
      db.update(productImages)
        .set({ isPrimary: true })
        .where(eq(productImages.id, next.id))
        .run();
    }

    // Diskteki dosyayi da sil; birakilirsa yetim dosyalar birikiyor.
    if (image.url.startsWith("/uploads/")) {
      try {
        const { unlink } = await import("node:fs/promises");
        const path = await import("node:path");
        await unlink(path.join(process.cwd(), "public", image.url));
      } catch {
        // Dosya zaten yoksa sorun degil.
      }
    }

    await logActivity({
      actor,
      action: "product.image_delete",
      entityType: "product",
      entityId: image.productId,
      before: { url: image.url },
    });

    const product = db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.id, image.productId))
      .get();
    revalidatePath(`/admin/urunler/${image.productId}`);
    revalidateStorefront(product?.slug);
    return ok(undefined, "Görsel silindi.");
  });
}

export async function setPrimaryImageAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    await requirePermission("product.update");
    const imageId = String(formData.get("imageId") ?? "");
    const image = db.select().from(productImages).where(eq(productImages.id, imageId)).get();
    if (!image) return fail("Görsel bulunamadı.");

    db.transaction((tx) => {
      tx.update(productImages)
        .set({ isPrimary: false })
        .where(eq(productImages.productId, image.productId))
        .run();
      tx.update(productImages)
        .set({ isPrimary: true, sortOrder: -1 })
        .where(eq(productImages.id, imageId))
        .run();
    });

    revalidatePath(`/admin/urunler/${image.productId}`);
    return ok(undefined, "Ana görsel değiştirildi.");
  });
}

/* ---------------------------------------------------------------------------
 * Gorsel yukleme.
 *
 * Dosyalar public/uploads altina yazilir ve next/image ile servis edilir;
 * boyutlandirma ve webp'ye cevirme istek aninda Next tarafindan yapilir, bu
 * yuzden burada yeniden kodlama yoktur. Dogrulama sunucuda: tur, boyut, adet.
 * Nesne depolamaya (S3 vb.) gecildiginde yalnizca bu fonksiyon degisir.
 * ------------------------------------------------------------------------ */


/**
 * Dosyalari diske yazip veritabanina isler.
 * Hem yeni urun formundan hem de gorsel sekmesinden cagrilir; kural tek yerde.
 * Hata durumunda mesaj doner, hicbir dosya yazilmaz gibi davranmak yerine
 * o ana kadar yazilanlar korunur - kismi yukleme kullanicidan gizlenmez.
 */
async function storeProductImages(
  productId: string,
  productName: string,
  files: File[],
): Promise<{ saved: number; error?: string }> {
  if (files.length === 0) return { saved: 0 };

  // Tur, tekil boyut ve TOPLAM boyut tek yerde dogrulanir. Toplam kontrolu
  // sart: Next'in govde siniri asilirsa istek bu koda hic ulasmaz.
  const check = checkFiles(files);
  if (!check.ok) return { saved: 0, error: check.error };

  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const sharp = (await import("sharp")).default;

  const dir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await mkdir(dir, { recursive: true });

  const current = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .get();
  let sortOrder = current?.n ?? 0;
  let saved = 0;

  // Uzanti tarayicinin bildirdigi file.type'a gore degil, dosyanin GERCEK
  // icerigine gore verilir. Bazi tarayicilar (ve araya giren proxy'ler) yanlis
  // MIME bildirip icerigi bozuk .webp olarak yazdirabiliyordu; next/image bunu
  // "gecerli gorsel degil" diye reddedip resmi indirilecek dosya olarak
  // donuyor, sitede kirik gorunuyordu.
  const FORMAT_EXT: Record<string, string> = {
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    avif: "avif",
  };

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let ext: string | undefined;
    try {
      const meta = await sharp(buffer).metadata();
      ext = meta.format ? FORMAT_EXT[meta.format] : undefined;
    } catch {
      ext = undefined;
    }
    if (!ext) {
      return {
        saved,
        error: `${file.name} geçerli bir görsel değil ya da bozuk. JPEG veya PNG deneyin.`,
      };
    }

    const name = `${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), buffer);

    db.insert(productImages)
      .values({
        id: randomUUID(),
        productId,
        url: `/uploads/products/${productId}/${name}`,
        alt: productName,
        sortOrder,
        isPrimary: sortOrder === 0,
      })
      .run();
    sortOrder++;
    saved++;
  }

  return { saved };
}

/** Formdan gelen gercek dosyalar. Bos file input'lari elenir. */
function filesFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

export async function uploadImagesAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("product.update");
    const productId = String(formData.get("id") ?? "");
    const product = db.select().from(products).where(eq(products.id, productId)).get();
    if (!product) return fail("Ürün bulunamadı.");

    const files = filesFrom(formData);
    if (files.length === 0) return fail("Dosya seçilmedi.");

    const result = await storeProductImages(productId, product.name, files);
    if (result.error) return fail(result.error);

    await logActivity({
      actor,
      action: "product.image_upload",
      entityType: "product",
      entityId: productId,
      entityLabel: product.name,
      after: { count: result.saved },
    });

    revalidatePath(`/admin/urunler/${productId}`);
    revalidatePath("/");
    revalidatePath(`/urun/${product.slug}`);
    return ok(undefined, `${result.saved} görsel yüklendi.`);
  });
}
