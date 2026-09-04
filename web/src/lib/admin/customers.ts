import "server-only";

import { and, asc, count, desc, eq, isNull, like, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  customerEvents,
  customerNotes,
  customerPrices,
  favorites,
  orders,
  products,
  quotes,
  users,
} from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Musteri ve firma okuma sorgulari.
 *
 * Kullanici ile sirket ayridir: bir sirkette birden fazla kullanici olur
 * (spec: 9). Listeler her zaman sunucuda filtrelenip sayfalanir.
 * ------------------------------------------------------------------------ */

export const PAGE_SIZE = 25;

/* ------------------------------ kullanici ------------------------------- */

export type UserQuery = {
  q?: string;
  status?: string;
  role?: string;
  company?: string;
  city?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

const USER_SORT = {
  name: users.name,
  email: users.email,
  status: users.status,
  created: users.createdAt,
  login: users.lastLoginAt,
} as const;

function userWhere(q: UserQuery): SQL | undefined {
  const parts: (SQL | undefined)[] = [isNull(users.deletedAt)];
  if (q.status) parts.push(eq(users.status, q.status));
  if (q.role) parts.push(eq(users.role, q.role));
  if (q.company) parts.push(eq(users.companyId, q.company));
  if (q.city) parts.push(eq(companies.city, q.city));

  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${users.name})`, pattern),
        like(sql`lower(${users.surname})`, pattern),
        like(sql`lower(${users.email})`, pattern),
        like(sql`lower(${users.phone})`, pattern),
        like(sql`lower(${companies.name})`, pattern),
      ),
    );
  }
  return and(...parts.filter(Boolean));
}

export type UserListRow = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  createdAt: number;
  lastLoginAt: number | null;
  companyId: string | null;
  companyName: string | null;
  companyCity: string | null;
};

export function listUsers(q: UserQuery) {
  const where = userWhere(q);
  const page = Math.max(1, q.page ?? 1);

  const total =
    db
      .select({ n: count() })
      .from(users)
      .leftJoin(companies, eq(companies.id, users.companyId))
      .where(where)
      .get()?.n ?? 0;

  const column = USER_SORT[(q.sort ?? "created") as keyof typeof USER_SORT] ?? users.createdAt;
  const direction = q.dir === "asc" ? asc : desc;

  const rows = db
    .select({
      id: users.id,
      name: users.name,
      surname: users.surname,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      companyId: users.companyId,
      companyName: companies.name,
      companyCity: companies.city,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(where)
    .orderBy(direction(column), asc(users.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { rows, total, page };
}

/** Musteri detay panosunun tamami (spec: 12). */
export function getUserDetail(id: string) {
  const user = db
    .select({
      id: users.id,
      name: users.name,
      surname: users.surname,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      companyId: users.companyId,
      approvedAt: users.approvedAt,
      lastLoginAt: users.lastLoginAt,
      lastLoginIp: users.lastLoginIp,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
      companyName: companies.name,
      companyCity: companies.city,
      companyCountry: companies.country,
      companyAddress: companies.address,
      companyStatus: companies.status,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, id))
    .get();

  if (!user) return null;

  const userOrders = db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.userId, id), isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt))
    .limit(50)
    .all();

  const userQuotes = db
    .select({
      id: quotes.id,
      code: quotes.code,
      status: quotes.status,
      totalMinor: quotes.totalMinor,
      currency: quotes.currency,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(and(eq(quotes.userId, id), isNull(quotes.deletedAt)))
    .orderBy(desc(quotes.createdAt))
    .limit(50)
    .all();

  const userFavorites = db
    .select({
      productId: products.id,
      name: products.name,
      slug: products.slug,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .innerJoin(products, eq(products.id, favorites.productId))
    .where(eq(favorites.userId, id))
    .orderBy(desc(favorites.createdAt))
    .limit(30)
    .all();

  const events = db
    .select({
      id: customerEvents.id,
      type: customerEvents.type,
      meta: customerEvents.meta,
      createdAt: customerEvents.createdAt,
      productName: products.name,
      productId: products.id,
    })
    .from(customerEvents)
    .leftJoin(products, eq(products.id, customerEvents.productId))
    .where(eq(customerEvents.userId, id))
    .orderBy(desc(customerEvents.createdAt))
    .limit(40)
    .all();

  const notes = db
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.userId, id))
    .orderBy(desc(customerNotes.createdAt))
    .all();

  return { user, orders: userOrders, quotes: userQuotes, favorites: userFavorites, events, notes };
}

/* -------------------------------- firma --------------------------------- */

export type CompanyQuery = {
  q?: string;
  status?: string;
  city?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

const COMPANY_SORT = {
  name: companies.name,
  city: companies.city,
  status: companies.status,
  created: companies.createdAt,
} as const;

export function listCompanies(q: CompanyQuery) {
  const parts: (SQL | undefined)[] = [isNull(companies.deletedAt)];
  if (q.status) parts.push(eq(companies.status, q.status));
  if (q.city) parts.push(eq(companies.city, q.city));
  const term = q.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${companies.name})`, pattern),
        like(sql`lower(${companies.email})`, pattern),
        like(sql`lower(${companies.taxNumber})`, pattern),
        like(sql`lower(${companies.phone})`, pattern),
      ),
    );
  }
  const where = and(...parts.filter(Boolean));
  const page = Math.max(1, q.page ?? 1);

  const total = db.select({ n: count() }).from(companies).where(where).get()?.n ?? 0;

  const column =
    COMPANY_SORT[(q.sort ?? "created") as keyof typeof COMPANY_SORT] ?? companies.createdAt;
  const direction = q.dir === "asc" ? asc : desc;

  const userCount = sql<number>`(
    SELECT COUNT(*) FROM ${users}
    WHERE ${users.companyId} = ${companies.id} AND ${users.deletedAt} IS NULL
  )`;
  const orderCount = sql<number>`(
    SELECT COUNT(*) FROM ${orders}
    WHERE ${orders.companyId} = ${companies.id} AND ${orders.deletedAt} IS NULL
  )`;

  const rows = db
    .select({
      id: companies.id,
      name: companies.name,
      city: companies.city,
      country: companies.country,
      email: companies.email,
      phone: companies.phone,
      taxNumber: companies.taxNumber,
      status: companies.status,
      discountBp: companies.discountBp,
      createdAt: companies.createdAt,
      userCount,
      orderCount,
    })
    .from(companies)
    .where(where)
    .orderBy(direction(column), asc(companies.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { rows, total, page };
}

export function getCompanyDetail(id: string) {
  const company = db.select().from(companies).where(eq(companies.id, id)).get();
  if (!company) return null;

  const members = db
    .select({
      id: users.id,
      name: users.name,
      surname: users.surname,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(and(eq(users.companyId, id), isNull(users.deletedAt)))
    .orderBy(asc(users.name))
    .all();

  const companyOrders = db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.companyId, id), isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt))
    .limit(50)
    .all();

  const companyQuotes = db
    .select({
      id: quotes.id,
      code: quotes.code,
      status: quotes.status,
      totalMinor: quotes.totalMinor,
      currency: quotes.currency,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(and(eq(quotes.companyId, id), isNull(quotes.deletedAt)))
    .orderBy(desc(quotes.createdAt))
    .limit(50)
    .all();

  const prices = db
    .select({
      id: customerPrices.id,
      productId: customerPrices.productId,
      priceMinor: customerPrices.priceMinor,
      currency: customerPrices.currency,
      minQty: customerPrices.minQty,
      productName: products.name,
      productSku: products.sku,
      listPriceMinor: products.priceMinor,
      wholesaleMinor: products.wholesaleMinor,
    })
    .from(customerPrices)
    .leftJoin(products, eq(products.id, customerPrices.productId))
    .where(eq(customerPrices.companyId, id))
    .orderBy(asc(products.name))
    .all();

  const notes = db
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.companyId, id))
    .orderBy(desc(customerNotes.createdAt))
    .all();

  return { company, members, orders: companyOrders, quotes: companyQuotes, prices, notes };
}

/** Filtre acilir listesi icin sehirler. */
export function companyCities(): string[] {
  return db
    .selectDistinct({ city: companies.city })
    .from(companies)
    .where(and(isNull(companies.deletedAt), sql`${companies.city} IS NOT NULL`))
    .orderBy(asc(companies.city))
    .all()
    .map((r) => r.city!)
    .filter(Boolean);
}

/** Firma secici icin hafif liste. */
export function companyOptions(): { id: string; name: string }[] {
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .orderBy(asc(companies.name))
    .all();
}
