"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { companies, customerNotes, customerPrices, products, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { destroyAllSessionsFor } from "@/lib/auth/session";
import { isRole, isStaffRole } from "@/lib/auth/rbac";
import { type ActionResult, fail, fieldErrorsOf, guard, ok } from "./action";
import { diff, logActivity } from "./log";
import { parseMoney, slugify } from "./format";

/* ---------------------------------------------------------------------------
 * Musteri, firma ve hesap onay islemleri.
 *
 * Onay akisi (spec: 11): yeni kayitlar "pending" durumunda acilir; admin
 * approve/reject/suspend eder. Askiya alma ve reddetme kullanicinin acik
 * oturumlarini da dusurur - yalnizca bayrak cevirmek yetmez.
 * ------------------------------------------------------------------------ */

const ACCOUNT_STATUSES = ["pending", "active", "suspended", "rejected", "archived"] as const;

/* ---------------------------- durum degisimi ---------------------------- */

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(ACCOUNT_STATUSES),
});

export async function setUserStatusAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const parsed = statusSchema.safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
    });
    if (!parsed.success) return fail("Geçersiz istek.");
    const { id, status } = parsed.data;

    // Onay ve askiya alma ayri yetkilerdir; ikisi de admin isidir.
    const permission =
      status === "active" || status === "rejected" ? "customer.approve" : "customer.suspend";
    const actor = await requirePermission(permission);

    const before = db.select().from(users).where(eq(users.id, id)).get();
    if (!before) return fail("Kullanıcı bulunamadı.");

    // Kendi hesabini kilitleyip panelden disari atmak kolay bir kaza; engelle.
    if (before.id === actor.id && status !== "active") {
      return fail("Kendi hesabınızın durumunu değiştiremezsiniz.");
    }
    // Personel hesaplari musteri ekranindan degil, Ekip ekranindan yonetilir.
    if (isStaffRole(before.role) && !actor.permissions.has("staff.manage")) {
      return fail("Personel hesaplarını yönetmek için ekip yetkisi gerekir.");
    }

    db.update(users)
      .set({
        status,
        approvedAt: status === "active" ? (before.approvedAt ?? Date.now()) : before.approvedAt,
        approvedBy: status === "active" ? actor.id : before.approvedBy,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: Date.now(),
      })
      .where(eq(users.id, id))
      .run();

    // Erisimi kesilen kullanicinin acik oturumlari da kapanmali.
    if (status !== "active") destroyAllSessionsFor(id);

    await logActivity({
      actor,
      action: `customer.${status}`,
      entityType: "user",
      entityId: id,
      entityLabel: `${before.name} ${before.surname} (${before.email})`.trim(),
      before: { status: before.status },
      after: { status },
    });

    revalidatePath("/admin/musteriler");
    revalidatePath(`/admin/musteriler/${id}`);
    revalidatePath("/admin");

    const LABEL: Record<string, string> = {
      active: "onaylandı",
      pending: "onay bekliyor olarak işaretlendi",
      suspended: "askıya alındı",
      rejected: "reddedildi",
      archived: "arşive alındı",
    };
    return ok(undefined, `Hesap ${LABEL[status]}.`);
  });
}

/* ------------------------------ kullanici ------------------------------- */

const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta girin.")),
  name: z.string().trim().min(1, "Ad gerekli.").max(120),
  surname: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  companyId: z.string().trim().optional(),
  role: z.string().trim(),
  status: z.enum(ACCOUNT_STATUSES),
  password: z.string().optional(),
});

export async function saveUserAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));

    const input = parsed.data;
    const isNew = !input.id;
    const actor = await requirePermission(isNew ? "customer.create" : "customer.update");

    if (!isRole(input.role)) return fail("Geçersiz rol.", { role: "Geçersiz rol." });
    // Personel rolu atamak ayri bir yetkidir; musteri duzenleyen herkes yapamaz.
    if (isStaffRole(input.role) && !actor.permissions.has("staff.manage")) {
      return fail("Personel rolü atamak için ekip yetkisi gerekir.", {
        role: "Bu rolü atama yetkiniz yok.",
      });
    }

    const row = {
      email: input.email,
      name: input.name,
      surname: input.surname ?? "",
      phone: input.phone || null,
      companyId: input.companyId || null,
      role: input.role,
      status: input.status,
      updatedAt: Date.now(),
    };

    if (isNew) {
      const password = input.password ?? "";
      const problem = validatePassword(password);
      if (problem) return fail(problem, { password: problem });

      const id = randomUUID();
      db.insert(users)
        .values({
          id,
          passwordHash: await hashPassword(password),
          approvedAt: input.status === "active" ? Date.now() : null,
          approvedBy: input.status === "active" ? actor.id : null,
          ...row,
        })
        .run();

      await logActivity({
        actor,
        action: "customer.create",
        entityType: "user",
        entityId: id,
        entityLabel: `${input.name} (${input.email})`,
        after: { ...row, password: undefined },
      });

      revalidatePath("/admin/musteriler");
      redirect(`/admin/musteriler/${id}`);
    }

    const id = input.id!;
    const before = db.select().from(users).where(eq(users.id, id)).get();
    if (!before) return fail("Kullanıcı bulunamadı.");
    if (isStaffRole(before.role) && !actor.permissions.has("staff.manage")) {
      return fail("Personel hesaplarını yönetmek için ekip yetkisi gerekir.");
    }
    if (before.id === actor.id && input.role !== before.role) {
      return fail("Kendi rolünüzü değiştiremezsiniz.");
    }

    db.update(users).set(row).where(eq(users.id, id)).run();

    // Sifre yalnizca doldurulduysa degisir; bos alan "degistirme" demektir.
    if (input.password && input.password.length > 0) {
      const problem = validatePassword(input.password);
      if (problem) return fail(problem, { password: problem });
      db.update(users)
        .set({ passwordHash: await hashPassword(input.password) })
        .where(eq(users.id, id))
        .run();
      destroyAllSessionsFor(id);
    }

    if (row.status !== "active" && before.status === "active") destroyAllSessionsFor(id);

    const changed = diff(before as unknown as Record<string, unknown>, row);
    if (changed) {
      await logActivity({
        actor,
        action: "customer.update",
        entityType: "user",
        entityId: id,
        entityLabel: `${input.name} (${input.email})`,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidatePath("/admin/musteriler");
    revalidatePath(`/admin/musteriler/${id}`);
    return ok(undefined, "Kullanıcı güncellendi.");
  });
}

export async function deleteUserAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("customer.delete");
    const id = String(formData.get("id") ?? "");
    const restore = formData.get("restore") === "1";

    const before = db.select().from(users).where(eq(users.id, id)).get();
    if (!before) return fail("Kullanıcı bulunamadı.");
    if (before.id === actor.id) return fail("Kendi hesabınızı silemezsiniz.");

    // Fiziksel silme yok: siparis ve teklif gecmisi kullaniciya bagli kalir.
    db.update(users)
      .set({
        deletedAt: restore ? null : Date.now(),
        status: restore ? "suspended" : "archived",
        updatedAt: Date.now(),
      })
      .where(eq(users.id, id))
      .run();

    if (!restore) destroyAllSessionsFor(id);

    await logActivity({
      actor,
      action: restore ? "customer.restore" : "customer.delete",
      entityType: "user",
      entityId: id,
      entityLabel: `${before.name} ${before.surname} (${before.email})`.trim(),
      before: { status: before.status, deletedAt: before.deletedAt },
    });

    revalidatePath("/admin/musteriler");
    revalidatePath(`/admin/musteriler/${id}`);
    return ok(
      undefined,
      restore ? "Hesap geri alındı (askıda)." : "Hesap arşivlendi. Verileri korunuyor.",
    );
  });
}

/* -------------------------------- firma --------------------------------- */

const companySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Firma adı en az 2 karakter.").max(200),
  taxNumber: z.string().trim().max(40).optional(),
  taxOffice: z.string().trim().max(120).optional(),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
  status: z.enum(["pending", "active", "suspended", "archived"]),
  discount: z.string().optional(),
  currency: z.string().trim().max(3).optional(),
});

export async function saveCompanyAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const parsed = companySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));

    const input = parsed.data;
    const isNew = !input.id;
    const actor = await requirePermission(isNew ? "customer.create" : "customer.update");

    // Iskonto yuzde olarak girilir, baz puan olarak saklanir (12,5 -> 1250).
    const pct = Number(String(input.discount ?? "0").replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
      return fail("İskonto 0 ile 99 arasında olmalı.", { discount: "Geçersiz oran." });
    }

    const row = {
      name: input.name,
      taxNumber: input.taxNumber || null,
      taxOffice: input.taxOffice || null,
      country: input.country || "TR",
      city: input.city || null,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      website: input.website || null,
      status: input.status,
      discountBp: Math.round(pct * 100),
      currency: (input.currency || "TRY").toUpperCase(),
      updatedAt: Date.now(),
    };

    if (isNew) {
      const id = `${slugify(input.name).slice(0, 40) || "firma"}-${randomUUID().slice(0, 8)}`;
      db.insert(companies).values({ id, ...row }).run();
      await logActivity({
        actor,
        action: "company.create",
        entityType: "company",
        entityId: id,
        entityLabel: input.name,
        after: row,
      });
      revalidatePath("/admin/firmalar");
      redirect(`/admin/firmalar/${id}`);
    }

    const id = input.id!;
    const before = db.select().from(companies).where(eq(companies.id, id)).get();
    if (!before) return fail("Firma bulunamadı.");

    db.update(companies).set(row).where(eq(companies.id, id)).run();

    // Firma askiya alindiysa altindaki kullanicilarin oturumlari da dusmeli.
    if (row.status !== "active" && before.status === "active") {
      const members = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.companyId, id))
        .all();
      for (const m of members) destroyAllSessionsFor(m.id);
    }

    const changed = diff(before as unknown as Record<string, unknown>, row);
    if (changed) {
      await logActivity({
        actor,
        action: "company.update",
        entityType: "company",
        entityId: id,
        entityLabel: input.name,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidatePath("/admin/firmalar");
    revalidatePath(`/admin/firmalar/${id}`);
    return ok(undefined, "Firma güncellendi.");
  });
}

export async function archiveCompanyAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("customer.delete");
    const id = String(formData.get("id") ?? "");
    const restore = formData.get("restore") === "1";
    const before = db.select().from(companies).where(eq(companies.id, id)).get();
    if (!before) return fail("Firma bulunamadı.");

    if (!restore) {
      const members = db
        .select({ n: sql<number>`COUNT(*)` })
        .from(users)
        .where(and(eq(users.companyId, id), isNull(users.deletedAt)))
        .get();
      if ((members?.n ?? 0) > 0) {
        return fail(
          `Bu firmaya bağlı ${members!.n} kullanıcı var. Önce hesapları taşıyın veya arşivleyin.`,
        );
      }
    }

    db.update(companies)
      .set({
        deletedAt: restore ? null : Date.now(),
        status: restore ? "suspended" : "archived",
        updatedAt: Date.now(),
      })
      .where(eq(companies.id, id))
      .run();

    await logActivity({
      actor,
      action: restore ? "company.restore" : "company.archive",
      entityType: "company",
      entityId: id,
      entityLabel: before.name,
      before: { status: before.status },
    });

    revalidatePath("/admin/firmalar");
    return ok(undefined, restore ? "Firma geri alındı." : "Firma arşivlendi.");
  });
}

/* ------------------------------ dahili not ------------------------------ */

export async function addNoteAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("customer.update");
    const body = String(formData.get("body") ?? "").trim();
    if (body.length < 2) return fail("Not boş olamaz.", { body: "Not boş olamaz." });
    if (body.length > 4000) return fail("Not çok uzun.");

    const userId = String(formData.get("userId") ?? "") || null;
    const companyId = String(formData.get("companyId") ?? "") || null;
    if (!userId && !companyId) return fail("Notun bağlanacağı kayıt belirtilmedi.");

    db.insert(customerNotes)
      .values({
        id: randomUUID(),
        userId,
        companyId,
        authorId: actor.id,
        authorName: `${actor.name} ${actor.surname}`.trim(),
        body,
      })
      .run();

    if (userId) revalidatePath(`/admin/musteriler/${userId}`);
    if (companyId) revalidatePath(`/admin/firmalar/${companyId}`);
    return ok(undefined, "Not eklendi. Bu not müşteriye gösterilmez.");
  });
}

export async function deleteNoteAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    await requirePermission("customer.update");
    const id = String(formData.get("noteId") ?? "");
    const note = db.select().from(customerNotes).where(eq(customerNotes.id, id)).get();
    if (!note) return fail("Not bulunamadı.");

    db.delete(customerNotes).where(eq(customerNotes.id, id)).run();

    if (note.userId) revalidatePath(`/admin/musteriler/${note.userId}`);
    if (note.companyId) revalidatePath(`/admin/firmalar/${note.companyId}`);
    return ok(undefined, "Not silindi.");
  });
}

/* -------------------------- musteriye ozel fiyat ------------------------ */

export async function saveCustomerPriceAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("customer.price");
    const companyId = String(formData.get("companyId") ?? "");
    // Urun kimlik, SKU veya slug ile aranabilir: 100.000 urunlu bir katalogda
    // acilir liste kullanilamaz, admin kodu yazarak secer.
    const key = String(formData.get("productId") ?? "").trim();
    const priceMinor = parseMoney(String(formData.get("price") ?? ""));
    const minQty = Math.max(1, Math.floor(Number(formData.get("minQty")) || 1));

    const company = db.select().from(companies).where(eq(companies.id, companyId)).get();
    if (!company) return fail("Firma bulunamadı.");
    const product = db
      .select()
      .from(products)
      .where(
        and(
          isNull(products.deletedAt),
          or(eq(products.id, key), eq(products.sku, key), eq(products.slug, key)),
        ),
      )
      .get();
    if (!product) {
      return fail("Ürün bulunamadı.", {
        productId: "Bu kod veya slug ile ürün yok.",
      });
    }
    const productId = product.id;
    if (priceMinor === null) return fail("Geçerli bir fiyat girin.", { price: "Geçersiz fiyat." });

    // Ayni firma + urun icin tek satir tutulur; tekrar kaydetmek gunceller.
    const existing = db
      .select({ id: customerPrices.id })
      .from(customerPrices)
      .where(
        and(
          eq(customerPrices.companyId, companyId),
          eq(customerPrices.productId, productId),
          isNull(customerPrices.variantId),
        ),
      )
      .get();

    if (existing) {
      db.update(customerPrices)
        .set({ priceMinor, minQty, currency: product.currency, updatedAt: Date.now() })
        .where(eq(customerPrices.id, existing.id))
        .run();
    } else {
      db.insert(customerPrices)
        .values({
          id: randomUUID(),
          companyId,
          productId,
          priceMinor,
          minQty,
          currency: product.currency,
        })
        .run();
    }

    await logActivity({
      actor,
      action: "customer.price_set",
      entityType: "company",
      entityId: companyId,
      entityLabel: `${company.name} · ${product.name}`,
      after: { priceMinor, minQty },
    });

    revalidatePath(`/admin/firmalar/${companyId}`);
    return ok(undefined, "Müşteriye özel fiyat kaydedildi.");
  });
}

export async function deleteCustomerPriceAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("customer.price");
    const id = String(formData.get("priceId") ?? "");
    const row = db.select().from(customerPrices).where(eq(customerPrices.id, id)).get();
    if (!row) return fail("Kayıt bulunamadı.");

    db.delete(customerPrices).where(eq(customerPrices.id, id)).run();

    await logActivity({
      actor,
      action: "customer.price_delete",
      entityType: "company",
      entityId: row.companyId,
      before: { productId: row.productId, priceMinor: row.priceMinor },
    });

    revalidatePath(`/admin/firmalar/${row.companyId}`);
    return ok(undefined, "Özel fiyat kaldırıldı.");
  });
}
