"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { homeBanners } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { type ActionResult, fail, fieldErrorsOf, guard, ok } from "./action";
import { diff, logActivity } from "./log";
import { IMAGE_MIME_EXT, checkFiles } from "./upload-limits";

/* ---------------------------------------------------------------------------
 * Ana sayfa gorselleri: slaytlar ve uc giris karti.
 *
 * Gorseller public/uploads/banners altina yazilir ve next/image ile servis
 * edilir. Kayit silinince dosya da silinir; baska bir kayit ayni dosyayi
 * kullaniyorsa dosya birakilir.
 * ------------------------------------------------------------------------ */

const KINDS = ["slide", "card"] as const;

const schema = z.object({
  id: z.string().optional(),
  kind: z.enum(KINDS),
  eyebrow: z.string().trim().max(80).optional(),
  title: z.string().trim().max(120).optional(),
  accentTitle: z.string().trim().max(120).optional(),
  subtitle: z.string().trim().max(200).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(300).optional(),
  cta2Label: z.string().trim().max(60).optional(),
  cta2Href: z.string().trim().max(300).optional(),
  focus: z.string().trim().max(40).optional(),
  status: z.enum(["active", "hidden"]),
});

/** Site ici bir yol mu? Disari acilan baglantilar bilerek engellenir. */
function safeHref(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v.slice(0, 300);
}

/* ------------------------------ gorseller ------------------------------- */

async function storeImage(file: File): Promise<{ url?: string; error?: string }> {
  const check = checkFiles([file]);
  if (!check.ok) return { error: check.error };
  const ext = IMAGE_MIME_EXT[file.type];

  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "uploads", "banners");
  await mkdir(dir, { recursive: true });

  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/banners/${name}` };
}

/** Kayit disinda kullanilmayan yuklenmis dosyayi siler. */
async function removeUnusedImage(url: string | null, exceptId?: string) {
  if (!url || !url.startsWith("/uploads/banners/")) return;

  const stillUsed = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(homeBanners)
    .where(
      exceptId
        ? sql`${homeBanners.imageUrl} = ${url} AND ${homeBanners.id} <> ${exceptId}`
        : eq(homeBanners.imageUrl, url),
    )
    .get();
  if ((stillUsed?.n ?? 0) > 0) return;

  try {
    const { unlink } = await import("node:fs/promises");
    const path = await import("node:path");
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // Dosya zaten yoksa sorun degil; kayit silme islemi bundan etkilenmemeli.
  }
}

function revalidateHome() {
  revalidatePath("/");
  revalidatePath("/admin/banner");
}

/* ------------------------------- kaydet --------------------------------- */

export async function saveBannerAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("banner.update");
    const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));

    const input = parsed.data;
    const isNew = !input.id;

    const file = formData.get("image");
    let imageUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      const stored = await storeImage(file);
      if (stored.error) return fail(stored.error, { image: stored.error });
      imageUrl = stored.url!;
    }

    const row = {
      kind: input.kind,
      eyebrow: input.eyebrow || null,
      title: input.title || null,
      accentTitle: input.kind === "slide" ? input.accentTitle || null : null,
      subtitle: input.subtitle || null,
      ctaLabel: input.kind === "slide" ? input.ctaLabel || null : null,
      ctaHref: safeHref(input.ctaHref),
      cta2Label: input.kind === "slide" ? input.cta2Label || null : null,
      cta2Href: input.kind === "slide" ? safeHref(input.cta2Href) : null,
      focus: input.focus || null,
      status: input.status,
      updatedAt: Date.now(),
    };

    if (isNew) {
      if (!imageUrl) return fail("Görsel seçin.", { image: "Görsel gerekli." });

      const last = db
        .select({ n: sql<number>`COALESCE(MAX(${homeBanners.sortOrder}), -1)` })
        .from(homeBanners)
        .where(eq(homeBanners.kind, input.kind))
        .get();

      const id = randomUUID();
      db.insert(homeBanners)
        .values({ id, imageUrl, sortOrder: (last?.n ?? -1) + 1, ...row })
        .run();

      await logActivity({
        actor,
        action: "banner.create",
        entityType: "banner",
        entityId: id,
        entityLabel: input.title ?? input.kind,
        after: row,
      });

      revalidateHome();
      return ok(undefined, input.kind === "slide" ? "Slayt eklendi." : "Kart eklendi.");
    }

    const id = input.id!;
    const before = db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
    if (!before) return fail("Kayıt bulunamadı.");

    db.update(homeBanners)
      .set(imageUrl ? { ...row, imageUrl } : row)
      .where(eq(homeBanners.id, id))
      .run();

    // Gorsel degistiyse eskisini diskten temizle.
    if (imageUrl) await removeUnusedImage(before.imageUrl, id);

    const changed = diff(before as unknown as Record<string, unknown>, {
      ...row,
      ...(imageUrl ? { imageUrl } : {}),
    });
    if (changed) {
      await logActivity({
        actor,
        action: "banner.update",
        entityType: "banner",
        entityId: id,
        entityLabel: input.title ?? input.kind,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidateHome();
    return ok(undefined, "Kaydedildi.");
  });
}

/* -------------------------------- sil ----------------------------------- */

export async function deleteBannerAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("banner.update");
    const id = String(formData.get("id") ?? "");
    const row = db.select().from(homeBanners).where(eq(homeBanners.id, id)).get();
    if (!row) return fail("Kayıt bulunamadı.");

    db.delete(homeBanners).where(eq(homeBanners.id, id)).run();
    await removeUnusedImage(row.imageUrl);

    await logActivity({
      actor,
      action: "banner.delete",
      entityType: "banner",
      entityId: id,
      entityLabel: row.title ?? row.kind,
      before: { kind: row.kind, title: row.title, imageUrl: row.imageUrl },
    });

    revalidateHome();
    return ok(undefined, "Kayıt silindi.");
  });
}

/* ------------------------------ siralama -------------------------------- */

export async function reorderBannersAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    await requirePermission("banner.update");
    const ids = formData.getAll("bannerId").map(String);
    if (ids.length === 0) return fail("Sıralanacak kayıt yok.");

    const kind = String(formData.get("kind") ?? "");
    const owned = new Set(
      db
        .select({ id: homeBanners.id })
        .from(homeBanners)
        .where(eq(homeBanners.kind, kind))
        .orderBy(asc(homeBanners.sortOrder))
        .all()
        .map((r) => r.id),
    );

    db.transaction((tx) => {
      ids.forEach((id, i) => {
        if (!owned.has(id)) return;
        tx.update(homeBanners)
          .set({ sortOrder: i, updatedAt: Date.now() })
          .where(eq(homeBanners.id, id))
          .run();
      });
    });

    revalidateHome();
    return ok(undefined, "Sıralama kaydedildi.");
  });
}
