import "server-only";

import { and, asc, count, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  orderItems,
  orders,
  productVariants,
  products,
  quoteItems,
  quotes,
  users,
} from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Teklif ve siparis okuma sorgulari.
 *
 * Iki liste de ayni sekilde calisir: sunucu tarafinda filtre, siralama ve
 * sayfalama. Kalem satirlari yalnizca detay ekraninda cekilir.
 * ------------------------------------------------------------------------ */

export const PAGE_SIZE = 25;

export type SalesQuery = {
  q?: string;
  status?: string;
  company?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

/* ------------------------------- teklif --------------------------------- */

const QUOTE_SORT = {
  code: quotes.code,
  status: quotes.status,
  total: quotes.totalMinor,
  created: quotes.createdAt,
} as const;

export function listQuotes(q: SalesQuery) {
  const parts: (SQL | undefined)[] = [isNull(quotes.deletedAt)];
  if (q.status) parts.push(eq(quotes.status, q.status));
  if (q.company) parts.push(eq(quotes.companyId, q.company));

  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${quotes.code})`, pattern),
        like(sql`lower(${quotes.companyName})`, pattern),
        like(sql`lower(${quotes.contactName})`, pattern),
        like(sql`lower(${quotes.email})`, pattern),
        like(sql`lower(${quotes.phone})`, pattern),
      ),
    );
  }
  const where = and(...parts.filter(Boolean));
  const page = Math.max(1, q.page ?? 1);
  const total = db.select({ n: count() }).from(quotes).where(where).get()?.n ?? 0;

  const column = QUOTE_SORT[(q.sort ?? "created") as keyof typeof QUOTE_SORT] ?? quotes.createdAt;
  const direction = q.dir === "asc" ? asc : desc;

  const itemCount = sql<number>`(
    SELECT COUNT(*) FROM ${quoteItems} WHERE ${quoteItems.quoteId} = ${quotes.id}
  )`;
  const totalQty = sql<number>`(
    SELECT COALESCE(SUM(${quoteItems.qty}), 0) FROM ${quoteItems}
    WHERE ${quoteItems.quoteId} = ${quotes.id}
  )`;

  const rows = db
    .select({
      id: quotes.id,
      code: quotes.code,
      status: quotes.status,
      companyId: quotes.companyId,
      companyName: quotes.companyName,
      contactName: quotes.contactName,
      email: quotes.email,
      phone: quotes.phone,
      city: quotes.city,
      totalMinor: quotes.totalMinor,
      currency: quotes.currency,
      createdAt: quotes.createdAt,
      convertedOrderId: quotes.convertedOrderId,
      registeredCompany: companies.name,
      itemCount,
      totalQty,
    })
    .from(quotes)
    .leftJoin(companies, eq(companies.id, quotes.companyId))
    .where(where)
    .orderBy(direction(column), asc(quotes.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { rows, total, page };
}

export function getQuoteDetail(id: string) {
  const quote = db
    .select({
      id: quotes.id,
      code: quotes.code,
      status: quotes.status,
      companyId: quotes.companyId,
      userId: quotes.userId,
      companyName: quotes.companyName,
      contactName: quotes.contactName,
      email: quotes.email,
      phone: quotes.phone,
      city: quotes.city,
      note: quotes.note,
      adminNote: quotes.adminNote,
      currency: quotes.currency,
      totalMinor: quotes.totalMinor,
      validUntil: quotes.validUntil,
      convertedOrderId: quotes.convertedOrderId,
      sourceIp: quotes.sourceIp,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
      registeredCompany: companies.name,
      userName: users.name,
      userSurname: users.surname,
    })
    .from(quotes)
    .leftJoin(companies, eq(companies.id, quotes.companyId))
    .leftJoin(users, eq(users.id, quotes.userId))
    .where(eq(quotes.id, id))
    .get();

  if (!quote) return null;

  const items = db
    .select({
      id: quoteItems.id,
      productId: quoteItems.productId,
      variantId: quoteItems.variantId,
      name: quoteItems.name,
      sku: quoteItems.sku,
      colorName: quoteItems.colorName,
      sizeName: quoteItems.sizeName,
      qty: quoteItems.qty,
      quotedPriceMinor: quoteItems.quotedPriceMinor,
      note: quoteItems.note,
      listPriceMinor: products.priceMinor,
      wholesaleMinor: products.wholesaleMinor,
      productSlug: products.slug,
    })
    .from(quoteItems)
    .leftJoin(products, eq(products.id, quoteItems.productId))
    .where(eq(quoteItems.quoteId, id))
    .all();

  return { quote, items };
}

/* ------------------------------- siparis -------------------------------- */

const ORDER_SORT = {
  code: orders.code,
  status: orders.status,
  total: orders.totalMinor,
  created: orders.createdAt,
} as const;

export function listOrders(q: SalesQuery) {
  const parts: (SQL | undefined)[] = [isNull(orders.deletedAt)];
  if (q.status) parts.push(eq(orders.status, q.status));
  if (q.company) parts.push(eq(orders.companyId, q.company));

  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${orders.code})`, pattern),
        like(sql`lower(${orders.contactName})`, pattern),
        like(sql`lower(${orders.email})`, pattern),
        like(sql`lower(${orders.phone})`, pattern),
        like(sql`lower(${orders.trackingNumber})`, pattern),
      ),
    );
  }
  const where = and(...parts.filter(Boolean));
  const page = Math.max(1, q.page ?? 1);
  const total = db.select({ n: count() }).from(orders).where(where).get()?.n ?? 0;

  const column = ORDER_SORT[(q.sort ?? "created") as keyof typeof ORDER_SORT] ?? orders.createdAt;
  const direction = q.dir === "asc" ? asc : desc;

  const itemCount = sql<number>`(
    SELECT COUNT(*) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id}
  )`;

  const rows = db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      companyId: orders.companyId,
      companyName: companies.name,
      contactName: orders.contactName,
      email: orders.email,
      city: orders.city,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      trackingNumber: orders.trackingNumber,
      itemCount,
    })
    .from(orders)
    .leftJoin(companies, eq(companies.id, orders.companyId))
    .where(where)
    .orderBy(direction(column), asc(orders.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { rows, total, page };
}

export function getOrderDetail(id: string) {
  const order = db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      companyId: orders.companyId,
      userId: orders.userId,
      companyName: companies.name,
      contactName: orders.contactName,
      email: orders.email,
      phone: orders.phone,
      city: orders.city,
      country: orders.country,
      shippingAddress: orders.shippingAddress,
      billingAddress: orders.billingAddress,
      note: orders.note,
      adminNote: orders.adminNote,
      currency: orders.currency,
      subtotalMinor: orders.subtotalMinor,
      discountMinor: orders.discountMinor,
      taxMinor: orders.taxMinor,
      shippingMinor: orders.shippingMinor,
      totalMinor: orders.totalMinor,
      trackingNumber: orders.trackingNumber,
      carrier: orders.carrier,
      quoteId: orders.quoteId,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(companies, eq(companies.id, orders.companyId))
    .where(eq(orders.id, id))
    .get();

  if (!order) return null;

  const items = db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      sku: orderItems.sku,
      name: orderItems.name,
      colorName: orderItems.colorName,
      sizeName: orderItems.sizeName,
      qty: orderItems.qty,
      unitPriceMinor: orderItems.unitPriceMinor,
      totalMinor: orderItems.totalMinor,
      variantStock: productVariants.stock,
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(eq(orderItems.orderId, id))
    .all();

  return { order, items };
}
