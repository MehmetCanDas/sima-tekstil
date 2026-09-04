"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { orderItems, orders, quoteItems, quotes } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { type ActionResult, fail, guard, ok } from "./action";
import { diff, logActivity } from "./log";
import { parseMoney } from "./format";

/* ---------------------------------------------------------------------------
 * Teklif ve siparis yazma islemleri (spec: 14, 15).
 *
 * Teklif kalemlerinin fiyati admin tarafindan girilir; teklif toplami her zaman
 * kalemlerden yeniden hesaplanir, istemciden gelen toplama guvenilmez.
 * ------------------------------------------------------------------------ */

const QUOTE_STATUSES = [
  "new",
  "in_review",
  "quoted",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/* ------------------------------- teklif --------------------------------- */

/** Teklif toplamini kalemlerden yeniden hesaplar. */
function recomputeQuoteTotal(quoteId: string): number {
  const row = db
    .select({
      total: sql<number>`COALESCE(SUM(${quoteItems.qty} * COALESCE(${quoteItems.quotedPriceMinor}, 0)), 0)`,
    })
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId))
    .get();
  const total = row?.total ?? 0;
  db.update(quotes)
    .set({ totalMinor: total, updatedAt: Date.now() })
    .where(eq(quotes.id, quoteId))
    .run();
  return total;
}

export async function updateQuoteAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("quote.update");
    const id = String(formData.get("id") ?? "");
    const before = db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!before) return fail("Teklif bulunamadı.");

    const status = String(formData.get("status") ?? before.status);
    if (!(QUOTE_STATUSES as readonly string[]).includes(status)) {
      return fail("Geçersiz teklif durumu.");
    }
    // "converted" yalnizca siparise cevirme isleminde atanir; elle secilemez.
    if (status === "converted" && before.status !== "converted") {
      return fail("Bu durum yalnızca teklif siparişe çevrildiğinde atanır.");
    }

    const validRaw = String(formData.get("validUntil") ?? "").trim();
    const validUntil = validRaw ? Date.parse(`${validRaw}T23:59:59`) : null;

    const patch = {
      status,
      adminNote: String(formData.get("adminNote") ?? "").trim().slice(0, 4000) || null,
      note: String(formData.get("note") ?? "").trim().slice(0, 4000) || null,
      validUntil: Number.isFinite(validUntil) ? validUntil : null,
      updatedAt: Date.now(),
    };

    // Kalem fiyatlari ayni formda gelir; her kalem teklifin kendisine ait olmali.
    const owned = db
      .select({ id: quoteItems.id })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .all();
    const ownedIds = new Set(owned.map((r) => r.id));

    db.transaction((tx) => {
      tx.update(quotes).set(patch).where(eq(quotes.id, id)).run();
      for (const itemId of formData.getAll("itemId").map(String)) {
        if (!ownedIds.has(itemId)) continue;
        const price = parseMoney(String(formData.get(`price_${itemId}`) ?? ""));
        const qty = Math.max(1, Math.floor(Number(formData.get(`qty_${itemId}`)) || 1));
        tx.update(quoteItems)
          .set({ quotedPriceMinor: price, qty })
          .where(eq(quoteItems.id, itemId))
          .run();
      }
    });

    const total = recomputeQuoteTotal(id);

    const changed = diff(before as unknown as Record<string, unknown>, patch);
    if (changed) {
      await logActivity({
        actor,
        action: "quote.update",
        entityType: "quote",
        entityId: id,
        entityLabel: before.code,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidatePath("/admin/teklifler");
    revalidatePath(`/admin/teklifler/${id}`);
    revalidatePath("/admin");
    return ok(undefined, `Teklif kaydedildi. Toplam ${(total / 100).toFixed(2)}.`);
  });
}

/** Teklifi siparise cevirir (spec: 15). */
export async function convertQuoteAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("quote.convert");
    const id = String(formData.get("id") ?? "");
    const quote = db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!quote) return fail("Teklif bulunamadı.");
    if (quote.convertedOrderId) {
      return fail("Bu teklif zaten siparişe çevrilmiş.");
    }

    const items = db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).all();
    if (items.length === 0) return fail("Teklifte kalem yok.");
    const unpriced = items.filter((i) => i.quotedPriceMinor === null);
    if (unpriced.length > 0) {
      return fail(
        `${unpriced.length} kalemin teklif fiyatı girilmedi. Siparişe çevirmeden önce tüm fiyatları girin.`,
      );
    }

    const orderId = randomUUID();
    const code = orderCode();
    const subtotal = items.reduce((s, i) => s + i.qty * (i.quotedPriceMinor ?? 0), 0);

    db.transaction((tx) => {
      tx.insert(orders)
        .values({
          id: orderId,
          code,
          companyId: quote.companyId,
          userId: quote.userId,
          status: "pending",
          currency: quote.currency,
          subtotalMinor: subtotal,
          totalMinor: subtotal,
          contactName: quote.contactName,
          email: quote.email,
          phone: quote.phone,
          city: quote.city,
          note: quote.note,
          adminNote: quote.adminNote,
          quoteId: quote.id,
        })
        .run();

      for (const item of items) {
        tx.insert(orderItems)
          .values({
            id: randomUUID(),
            orderId,
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            name: item.name,
            colorName: item.colorName,
            sizeName: item.sizeName,
            qty: item.qty,
            unitPriceMinor: item.quotedPriceMinor ?? 0,
            totalMinor: item.qty * (item.quotedPriceMinor ?? 0),
          })
          .run();
      }

      tx.update(quotes)
        .set({ status: "converted", convertedOrderId: orderId, updatedAt: Date.now() })
        .where(eq(quotes.id, id))
        .run();
    });

    await logActivity({
      actor,
      action: "quote.convert",
      entityType: "quote",
      entityId: id,
      entityLabel: quote.code,
      after: { orderId, orderCode: code, totalMinor: subtotal },
    });

    revalidatePath("/admin/teklifler");
    revalidatePath("/admin/siparisler");
    redirect(`/admin/siparisler/${orderId}?created=1`);
  });
}

export async function archiveQuoteAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("quote.delete");
    const id = String(formData.get("id") ?? "");
    const restore = formData.get("restore") === "1";
    const quote = db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!quote) return fail("Teklif bulunamadı.");

    db.update(quotes)
      .set({ deletedAt: restore ? null : Date.now(), updatedAt: Date.now() })
      .where(eq(quotes.id, id))
      .run();

    await logActivity({
      actor,
      action: restore ? "quote.restore" : "quote.archive",
      entityType: "quote",
      entityId: id,
      entityLabel: quote.code,
    });

    revalidatePath("/admin/teklifler");
    return ok(undefined, restore ? "Teklif geri alındı." : "Teklif arşive alındı.");
  });
}

/* ------------------------------- siparis -------------------------------- */

function orderCode(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  for (let i = 0; i < 50; i++) {
    const candidate = `SP-${stamp}-${Math.floor(Math.random() * 9000) + 1000}`;
    const hit = db.select({ id: orders.id }).from(orders).where(eq(orders.code, candidate)).get();
    if (!hit) return candidate;
  }
  return `SP-${stamp}-${Date.now().toString().slice(-6)}`;
}

const orderPatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  adminNote: z.string().max(4000).optional(),
  note: z.string().max(4000).optional(),
  trackingNumber: z.string().max(120).optional(),
  carrier: z.string().max(120).optional(),
  shippingAddress: z.string().max(1000).optional(),
});

export async function updateOrderAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("order.update");
    const parsed = orderPatchSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail("Form eksik veya hatalı.");

    const input = parsed.data;
    const before = db.select().from(orders).where(eq(orders.id, input.id)).get();
    if (!before) return fail("Sipariş bulunamadı.");

    const patch = {
      status: input.status,
      adminNote: input.adminNote?.trim() || null,
      note: input.note?.trim() || null,
      trackingNumber: input.trackingNumber?.trim() || null,
      carrier: input.carrier?.trim() || null,
      shippingAddress: input.shippingAddress?.trim() || null,
      updatedAt: Date.now(),
    };

    db.update(orders).set(patch).where(eq(orders.id, input.id)).run();

    const changed = diff(before as unknown as Record<string, unknown>, patch);
    if (changed) {
      await logActivity({
        actor,
        action:
          before.status !== patch.status ? "order.status_change" : "order.update",
        entityType: "order",
        entityId: input.id,
        entityLabel: before.code,
        before: changed.before,
        after: changed.after,
      });
    }

    revalidatePath("/admin/siparisler");
    revalidatePath(`/admin/siparisler/${input.id}`);
    revalidatePath("/admin");
    return ok(undefined, "Sipariş güncellendi.");
  });
}

export async function archiveOrderAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("order.delete");
    const id = String(formData.get("id") ?? "");
    const restore = formData.get("restore") === "1";
    const order = db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) return fail("Sipariş bulunamadı.");

    db.update(orders)
      .set({ deletedAt: restore ? null : Date.now(), updatedAt: Date.now() })
      .where(eq(orders.id, id))
      .run();

    await logActivity({
      actor,
      action: restore ? "order.restore" : "order.archive",
      entityType: "order",
      entityId: id,
      entityLabel: order.code,
    });

    revalidatePath("/admin/siparisler");
    return ok(undefined, restore ? "Sipariş geri alındı." : "Sipariş arşive alındı.");
  });
}
