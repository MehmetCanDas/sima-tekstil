"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { type ActionResult, fail, fieldErrorsOf, guard, ok } from "./action";
import { diff, logActivity } from "./log";
import { slugify } from "./format";

/* ---------------------------------------------------------------------------
 * Kategori yonetimi.
 *
 * Hiyerarsi tek seviyeli tutulur (kategori -> alt kategori). Daha derin
 * agaclara ihtiyac dogarsa parentId zaten serbest; kisitlama yalnizca burada,
 * dogrulama katmanindadir.
 * ------------------------------------------------------------------------ */

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Kategori adı en az 2 karakter.").max(120),
  slug: z.string().trim().max(120).optional(),
  parentId: z.string().trim().optional(),
  world: z.enum(["is-kiyafetleri", "promosyon"]).default("is-kiyafetleri"),
  description: z.string().trim().max(2000).optional(),
  image: z.string().trim().max(500).optional(),
  sortOrder: z.string().optional(),
  status: z.enum(["active", "hidden", "archived"]).default("active"),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
});

function uniqueSlug(base: string, exceptId?: string): string {
  const root = slugify(base) || `kategori-${Date.now()}`;
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    const hit = db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, candidate))
      .get();
    if (!hit || hit.id === exceptId) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function saveCategoryAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));

    const input = parsed.data;
    const isNew = !input.id;
    const actor = await requirePermission(isNew ? "category.create" : "category.update");

    const sortOrder = Number(input.sortOrder);
    const row = {
      name: input.name,
      parentId: input.parentId || null,
      world: input.world,
      description: input.description || null,
      image: input.image || null,
      sortOrder: Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0,
      status: input.status,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      updatedAt: Date.now(),
    };

    if (isNew) {
      const id = uniqueSlug(input.slug || input.name);
      db.insert(categories)
        .values({ id, slug: id, ...row })
        .run();
      await logActivity({
        actor,
        action: "category.create",
        entityType: "category",
        entityId: id,
        entityLabel: input.name,
        after: row,
      });
    } else {
      const id = input.id!;
      const before = db.select().from(categories).where(eq(categories.id, id)).get();
      if (!before) return fail("Kategori bulunamadı.");

      // Kendi kendine ust kategori olamaz; agac dongusu olusurdu.
      if (row.parentId === id) {
        return fail("Bir kategori kendi üst kategorisi olamaz.", {
          parentId: "Geçersiz üst kategori.",
        });
      }
      // Alt kategorisi olan bir kategori baskasinin altina tasinamaz (tek seviye).
      if (row.parentId) {
        const childCount = db
          .select({ n: sql<number>`COUNT(*)` })
          .from(categories)
          .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)))
          .get();
        if ((childCount?.n ?? 0) > 0) {
          return fail("Alt kategorisi olan bir kategori başka bir kategorinin altına taşınamaz.", {
            parentId: "Önce alt kategorileri taşıyın.",
          });
        }
      }

      const slug = input.slug ? uniqueSlug(input.slug, id) : before.slug;
      db.update(categories)
        .set({ ...row, slug })
        .where(eq(categories.id, id))
        .run();

      const changed = diff(before as unknown as Record<string, unknown>, { ...row, slug });
      if (changed) {
        await logActivity({
          actor,
          action: "category.update",
          entityType: "category",
          entityId: id,
          entityLabel: input.name,
          before: changed.before,
          after: changed.after,
        });
      }
    }

    revalidatePath("/admin/kategoriler");
    revalidatePath("/admin/urunler");
    return ok(undefined, isNew ? "Kategori oluşturuldu." : "Kategori güncellendi.");
  });
}

export async function archiveCategoryAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("category.delete");
    const id = String(formData.get("id") ?? "");
    const category = db.select().from(categories).where(eq(categories.id, id)).get();
    if (!category) return fail("Kategori bulunamadı.");

    const restore = formData.get("restore") === "1";

    if (!restore) {
      // Icinde urun veya alt kategori varken arsivlemek sessiz veri kaybi olur.
      const used = db
        .select({ n: sql<number>`COUNT(*)` })
        .from(products)
        .where(
          and(
            or(eq(products.categoryId, id), eq(products.subcategoryId, id)),
            isNull(products.deletedAt),
          ),
        )
        .get();
      if ((used?.n ?? 0) > 0) {
        return fail(
          `Bu kategoride ${used!.n} ürün var. Önce ürünleri başka bir kategoriye taşıyın.`,
        );
      }
      const children = db
        .select({ n: sql<number>`COUNT(*)` })
        .from(categories)
        .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)))
        .get();
      if ((children?.n ?? 0) > 0) {
        return fail("Bu kategorinin alt kategorileri var. Önce onları taşıyın veya arşivleyin.");
      }
    }

    db.update(categories)
      .set({ status: restore ? "active" : "archived", updatedAt: Date.now() })
      .where(eq(categories.id, id))
      .run();

    await logActivity({
      actor,
      action: restore ? "category.restore" : "category.archive",
      entityType: "category",
      entityId: id,
      entityLabel: category.name,
      before: { status: category.status },
      after: { status: restore ? "active" : "archived" },
    });

    revalidatePath("/admin/kategoriler");
    return ok(undefined, restore ? "Kategori geri alındı." : "Kategori arşive alındı.");
  });
}

/** Siralamayi tek gonderimde kaydeder. */
export async function reorderCategoriesAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    await requirePermission("category.update");
    const ids = formData.getAll("categoryId").map(String);
    if (ids.length === 0) return fail("Sıralanacak kategori yok.");

    db.transaction((tx) => {
      ids.forEach((id, i) => {
        tx.update(categories)
          .set({ sortOrder: i, updatedAt: Date.now() })
          .where(eq(categories.id, id))
          .run();
      });
    });

    revalidatePath("/admin/kategoriler");
    return ok(undefined, "Sıralama kaydedildi.");
  });
}
