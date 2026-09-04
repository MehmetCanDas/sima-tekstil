import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ---------------------------------------------------------------------------
 * Sima Tekstil - B2B veri semasi.
 *
 * Kurallar:
 *  - Para degerleri tam sayi olarak "minor unit" (kurus) tutulur. Float yok.
 *  - Zaman damgalari epoch milisaniye (integer).
 *  - Kritik kayitlar fiziksel silinmez: status + deletedAt (soft delete).
 *  - Sema SQLite uzerinde calisir; ayni tanimlar Postgres'e tasinabilir
 *    (degisen tek sey driver ve drizzle-orm/pg-core importu).
 * ------------------------------------------------------------------------ */

const now = sql`(unixepoch() * 1000)`;

const timestamps = {
  createdAt: integer("created_at").notNull().default(now),
  updatedAt: integer("updated_at").notNull().default(now),
};

/* ============================ ORGANIZASYON =============================== */

/** B2B musteri sirketi. Kullanicidan ayridir; bir sirkette N kullanici olur. */
export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    taxNumber: text("tax_number"),
    taxOffice: text("tax_office"),
    country: text("country").notNull().default("TR"),
    city: text("city"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    /** active | pending | suspended | archived */
    status: text("status").notNull().default("pending"),
    /** Sirkete ozel varsayilan iskonto, baz puan (1250 = %12,5). */
    discountBp: integer("discount_bp").notNull().default(0),
    currency: text("currency").notNull().default("TRY"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    index("companies_status_idx").on(t.status),
    index("companies_city_idx").on(t.city),
    index("companies_name_idx").on(t.name),
  ],
);

/** Hem panel kullanicilari hem B2B musteri kullanicilari ayni tabloda tutulur. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companies.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    surname: text("surname").notNull().default(""),
    phone: text("phone"),
    /** customer | company_admin | sales_manager | admin | super_admin */
    role: text("role").notNull().default("customer"),
    /** pending | active | suspended | rejected | archived */
    status: text("status").notNull().default("pending"),
    approvedAt: integer("approved_at"),
    approvedBy: text("approved_by"),
    lastLoginAt: integer("last_login_at"),
    lastLoginIp: text("last_login_ip"),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: integer("locked_until"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_company_idx").on(t.companyId),
    index("users_status_idx").on(t.status),
    index("users_role_idx").on(t.role),
  ],
);

/** Sunucu tarafinda tutulan oturum. Cookie yalnizca token tasir. */
export const sessions = sqliteTable(
  "sessions",
  {
    /** Cookie'deki token'in SHA-256 ozeti. Token'in kendisi saklanmaz. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_exp_idx").on(t.expiresAt),
  ],
);

/** Rolden gelen varsayilanin uzerine binen, kullanici bazli izin istisnasi. */
export const userPermissions = sqliteTable(
  "user_permissions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    /** true = ek yetki, false = rolden gelen yetkinin iptali. */
    allow: integer("allow", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permission] })],
);

/* ============================== KATALOG ================================= */

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    /** Ust seviye ayrim: is-kiyafetleri | promosyon */
    world: text("world").notNull().default("is-kiyafetleri"),
    description: text("description"),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** active | hidden | archived */
    status: text("status").notNull().default("active"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("categories_slug_uq").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
  ],
);

export const sectors = sqliteTable("sectors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const colors = sqliteTable("colors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hex: text("hex").notNull().default("#cccccc"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const sizes = sqliteTable("sizes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    sku: text("sku"),
    name: text("name").notNull(),
    /** Katalogda basili orijinal baslik; izlenebilirlik icin korunur. */
    catalogTitle: text("catalog_title"),
    categoryId: text("category_id").references(() => categories.id),
    /** Alt kategori de categories tablosundadir. */
    subcategoryId: text("subcategory_id").references(() => categories.id),
    /** unisex | kadin | erkek | cocuk */
    gender: text("gender").notNull().default("unisex"),
    description: text("description"),
    fabricType: text("fabric_type"),
    fabricContent: text("fabric_content"),
    /** JSON dizisi: urun ozellikleri. */
    features: text("features").notNull().default("[]"),
    /** Liste fiyati, kurus. */
    priceMinor: integer("price_minor"),
    /** Toptan fiyat, kurus. */
    wholesaleMinor: integer("wholesale_minor"),
    /** Toptan fiyatin gecerli oldugu en dusuk adet. Altinda liste fiyati uygulanir. */
    wholesaleMinQty: integer("wholesale_min_qty"),
    currency: text("currency").notNull().default("TRY"),
    moq: integer("moq"),
    moqUnit: text("moq_unit"),
    /** Varyanti olmayan urunlerde stok; varyant varsa varyantlardan toplanir. */
    stock: integer("stock").notNull().default(0),
    /** active | draft | out_of_stock | archived */
    status: text("status").notNull().default("draft"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    sourcePage: integer("source_page"),
    /** Katalogdan gelen, firmadan beklenen eksik alanlar (JSON dizisi). */
    dataGaps: text("data_gaps").notNull().default("[]"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_sku_idx").on(t.sku),
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
    index("products_stock_idx").on(t.stock),
    index("products_featured_idx").on(t.featured),
  ],
);

export const productSectors = sqliteTable(
  "product_sectors",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sectorId: text("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.sectorId] })],
);

/** Urunun sundugu renk secenekleri: varyant uretiminin eksenlerinden biri. */
export const productColors = sqliteTable(
  "product_colors",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: text("color_id")
      .notNull()
      .references(() => colors.id, { onDelete: "cascade" }),
    /** Cift renkli urunlerde ikincil renk. */
    secondaryColorId: text("secondary_color_id").references(() => colors.id),
    /** Katalogda basili ham etiket. */
    label: text("label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.colorId] })],
);

/** Urunun sundugu beden secenekleri: varyant uretiminin diger ekseni. */
export const productSizes = sqliteTable(
  "product_sizes",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sizeId: text("size_id")
      .notNull()
      .references(() => sizes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.sizeId] })],
);

/** Renk x Beden kombinasyonu: kendi SKU'su, stogu ve fiyati olan satis birimi. */
export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: text("color_id").references(() => colors.id),
    sizeId: text("size_id").references(() => sizes.id),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    stock: integer("stock").notNull().default(0),
    /** Bos ise urun fiyati gecerlidir. */
    priceMinor: integer("price_minor"),
    wholesaleMinor: integer("wholesale_minor"),
    /** active | inactive */
    status: text("status").notNull().default("active"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("variants_sku_uq").on(t.sku),
    uniqueIndex("variants_combo_uq").on(t.productId, t.colorId, t.sizeId),
    index("variants_product_idx").on(t.productId),
  ],
);

export const productImages = sqliteTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Renk bazli galeri icin opsiyonel baglanti. */
    colorId: text("color_id").references(() => colors.id),
    url: text("url").notNull(),
    alt: text("alt"),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("images_product_idx").on(t.productId, t.sortOrder)],
);

/* ======================== MUSTERIYE OZEL FIYAT ========================== */

/**
 * Musteri bazli fiyatlandirma. Cozunurluk sirasi (dardan genise):
 *   varyant + sirket  >  urun + sirket  >  sirket iskontosu  >  toptan fiyat
 */
export const customerPrices = sqliteTable(
  "customer_prices",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull().default("TRY"),
    minQty: integer("min_qty").notNull().default(1),
    validFrom: integer("valid_from"),
    validTo: integer("valid_to"),
    ...timestamps,
  },
  (t) => [
    index("cprices_company_idx").on(t.companyId),
    index("cprices_product_idx").on(t.productId),
  ],
);

/* ============================== SIPARIS ================================= */

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    companyId: text("company_id").references(() => companies.id),
    userId: text("user_id").references(() => users.id),
    /** pending | confirmed | processing | ready_to_ship | shipped | delivered | cancelled */
    status: text("status").notNull().default("pending"),
    currency: text("currency").notNull().default("TRY"),
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    shippingMinor: integer("shipping_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    shippingAddress: text("shipping_address"),
    billingAddress: text("billing_address"),
    city: text("city"),
    country: text("country").notNull().default("TR"),
    /** Musteriye gorunen not. */
    note: text("note"),
    /** Yalnizca panelde gorunur; musteriye asla gosterilmez. */
    adminNote: text("admin_note"),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    /** Tekliften donusen siparislerde kaynak teklif. */
    quoteId: text("quote_id"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_code_uq").on(t.code),
    index("orders_status_idx").on(t.status),
    index("orders_company_idx").on(t.companyId),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id),
    variantId: text("variant_id").references(() => productVariants.id),
    /** Siparis anindaki degerler dondurulur; urun sonra degisse de kayit sabit kalir. */
    sku: text("sku"),
    name: text("name").notNull(),
    colorName: text("color_name"),
    sizeName: text("size_name"),
    qty: integer("qty").notNull().default(1),
    unitPriceMinor: integer("unit_price_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/* =============================== TEKLIF ================================= */

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    companyId: text("company_id").references(() => companies.id),
    userId: text("user_id").references(() => users.id),
    /** Uye olmayan ziyaretcinin de teklif birakabilmesi icin serbest alanlar. */
    companyName: text("company_name"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    city: text("city"),
    note: text("note"),
    /** Yalnizca panelde gorunur; musteriye asla gosterilmez. */
    adminNote: text("admin_note"),
    /** new | in_review | quoted | accepted | rejected | expired | converted */
    status: text("status").notNull().default("new"),
    currency: text("currency").notNull().default("TRY"),
    totalMinor: integer("total_minor").notNull().default(0),
    validUntil: integer("valid_until"),
    convertedOrderId: text("converted_order_id"),
    assignedTo: text("assigned_to").references(() => users.id),
    sourceIp: text("source_ip"),
    deletedAt: integer("deleted_at"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("quotes_code_uq").on(t.code),
    index("quotes_status_idx").on(t.status),
    index("quotes_company_idx").on(t.companyId),
    index("quotes_created_idx").on(t.createdAt),
  ],
);

export const quoteItems = sqliteTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id),
    variantId: text("variant_id").references(() => productVariants.id),
    colorId: text("color_id").references(() => colors.id),
    name: text("name").notNull(),
    sku: text("sku"),
    colorName: text("color_name"),
    sizeName: text("size_name"),
    qty: integer("qty").notNull().default(1),
    /** Admin'in girdigi teklif fiyati. */
    quotedPriceMinor: integer("quoted_price_minor"),
    note: text("note"),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId)],
);

/* ========================= MUSTERI ILISKISI ============================= */

/** Admin'in musteri hakkindaki dahili notu. Musteriye asla gosterilmez. */
export const customerNotes = sqliteTable(
  "customer_notes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id),
    authorName: text("author_name"),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("cnotes_company_idx").on(t.companyId),
    index("cnotes_user_idx").on(t.userId),
  ],
);

export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

/** Musteri aktivitesi: urun goruntuleme, sepete ekleme, teklif acma, giris. */
export const customerEvents = sqliteTable(
  "customer_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    /** product_view | cart_add | quote_request | login | search */
    type: text("type").notNull(),
    productId: text("product_id").references(() => products.id),
    meta: text("meta"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("cevents_user_idx").on(t.userId, t.createdAt),
    index("cevents_type_idx").on(t.type),
  ],
);

/* =========================== SISTEM / LOG =============================== */

/** Panelde yapilan kritik islemlerin denetim kaydi. */
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id),
    actorName: text("actor_name"),
    /** product.update, customer.suspend, order.status_change ... */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    entityLabel: text("entity_label"),
    /** Degisen alanlarin oncesi/sonrasi (JSON). */
    before: text("before"),
    after: text("after"),
    ip: text("ip"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("log_created_idx").on(t.createdAt),
    index("log_actor_idx").on(t.actorId),
    index("log_entity_idx").on(t.entityType, t.entityId),
  ],
);

/**
 * Ana sayfa gorselleri: slaytlar ve altindaki uc giris karti.
 *
 * Ikisi de ayni sekli paylastigi icin tek tabloda tutuluyor; "kind" hangisi
 * oldugunu soyler. Slaytlar ikinci bir butonu ve el yazisi alt basligi da
 * kullanir, kartlar bu alanlari bos birakir.
 */
export const homeBanners = sqliteTable(
  "home_banners",
  {
    id: text("id").primaryKey(),
    /** slide | card */
    kind: text("kind").notNull(),
    imageUrl: text("image_url"),
    /** Gorselin ekran oranina sigmadigi durumda korunacak kenar. */
    focus: text("focus"),
    eyebrow: text("eyebrow"),
    title: text("title"),
    /** Slaytta basligin altindaki italik satir. */
    accentTitle: text("accent_title"),
    subtitle: text("subtitle"),
    ctaLabel: text("cta_label"),
    ctaHref: text("cta_href"),
    cta2Label: text("cta2_label"),
    cta2Href: text("cta2_href"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** active | hidden */
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [index("home_banners_kind_idx").on(t.kind, t.sortOrder)],
);

/** Feature flag ve site ayarlari. Deger JSON olarak saklanir. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().default(now),
  updatedBy: text("updated_by"),
});

/** Toplu ice aktarma calismalarinin gecmisi ve hata raporu. */
export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => users.id),
  fileName: text("file_name"),
  format: text("format"),
  /** preview | applied | failed */
  status: text("status").notNull().default("preview"),
  created: integer("created").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  /** Hatali satirlarin raporu (JSON). */
  report: text("report"),
  createdAt: integer("created_at").notNull().default(now),
});

/* Depo yonetimi geldiginde warehouses + inventory(variantId, warehouseId, qty)
 * tablolari eklenir ve productVariants.stock toplam onbellegi olur. Stok yazan
 * her yol lib/admin/stock.ts uzerinden gectigi icin gecis cagri yerlerini
 * degistirmez. */

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductVariantRow = typeof productVariants.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type QuoteRow = typeof quotes.$inferSelect;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type HomeBannerRow = typeof homeBanners.$inferSelect;
