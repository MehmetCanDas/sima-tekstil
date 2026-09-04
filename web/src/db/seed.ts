import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import Database from "better-sqlite3";

/* ---------------------------------------------------------------------------
 * Ilk kurulum verisi. `npm run db:seed`.
 *
 * Idempotent: tekrar calistirmak mevcut kayitlari cogaltmaz, eksikleri tamamlar.
 * Urunler "active" yazilir: site fiyatsiz da calisiyor (fiyat girilmemis urunde
 * "Teklif Al" gorunur), bu yuzden yayinda olmalari dogru baslangic.
 * ------------------------------------------------------------------------ */

const root = process.cwd();
const file = process.env.DATABASE_FILE ?? path.join(root, "data", "sima.db");
const db = new Database(file);
db.pragma("foreign_keys = ON");

const now = Date.now();

type CatalogColor = { id: string; name: string; hex: string; secondary: CatalogColor | null; label: string };
type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  catalogTitle: string;
  category: string;
  subcategory: string;
  sectors: string[];
  fabrics: string[];
  colors: CatalogColor[];
  images: string[];
  sourcePage: number;
  sku: string | null;
  listPrice: number | null;
  currency: string;
  moq: number | null;
  moqUnit: string | null;
  sizes: string[];
  dataGaps: string[];
};

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "src", "data", "catalog.json"), "utf8"),
) as {
  categories: { id: string; name: string; world: string }[];
  sectors: { id: string; name: string }[];
  colors: { id: string; name: string; hex: string }[];
  products: CatalogProduct[];
};

/* ------------------------------- sifre -------------------------------- */

function hashPassword(password: string): string {
  const N = 16384;
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, 64, {
    N,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", N, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
}

/* ------------------------------ yardimci ------------------------------ */

const slugify = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const run = db.transaction(() => {
  /* --------------------------- ayarlar ------------------------------- */
  const setSetting = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING",
  );
  const defaults: Record<string, unknown> = {
    // Kayit sonrasi hesaplar admin onayi bekler.
    require_customer_approval: true,
    // Fiyatlari yalnizca onayli B2B musteriler gorur.
    prices_require_approval: true,
    default_currency: "TRY",
    default_moq_unit: "adet",
    low_stock_threshold: 20,
  };
  for (const [key, value] of Object.entries(defaults)) {
    setSetting.run(key, JSON.stringify(value), now);
  }

  /* ---------------------------- bedenler ------------------------------ */
  const insertSize = db.prepare(
    "INSERT INTO sizes (id, name, sort_order) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING",
  );
  ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"].forEach((name, i) =>
    insertSize.run(slugify(name), name, i),
  );

  /* ----------------------------- renkler ------------------------------ */
  const insertColor = db.prepare(
    "INSERT INTO colors (id, name, hex, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, hex = excluded.hex",
  );
  catalog.colors.forEach((c, i) => insertColor.run(c.id, c.name, c.hex, i));

  /* ---------------------------- sektorler ----------------------------- */
  const insertSector = db.prepare(
    "INSERT INTO sectors (id, name, sort_order) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
  );
  catalog.sectors.forEach((s, i) => insertSector.run(s.id, s.name, i));

  /* ---------------------------- kategoriler --------------------------- */
  const insertCategory = db.prepare(
    `INSERT INTO categories (id, slug, name, parent_id, world, sort_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, world = excluded.world`,
  );
  catalog.categories.forEach((c, i) =>
    insertCategory.run(c.id, c.id, c.name, null, c.world, i, now, now),
  );

  // Alt kategoriler urunlerden turetilir; katalogda ayri liste yok.
  const subs = new Map<string, { parent: string; world: string }>();
  for (const p of catalog.products) {
    if (!p.subcategory) continue;
    const parent = catalog.categories.find((c) => c.id === p.category);
    if (!subs.has(p.subcategory)) {
      subs.set(p.subcategory, {
        parent: p.category,
        world: parent?.world ?? "is-kiyafetleri",
      });
    }
  }
  let order = 0;
  for (const [id, meta] of subs) {
    const name = id
      .split("-")
      .map((w) => w.charAt(0).toLocaleUpperCase("tr") + w.slice(1))
      .join(" ");
    insertCategory.run(id, id, name, meta.parent, meta.world, order++, now, now);
  }

  /* ------------------------------ urunler ----------------------------- */
  const insertProduct = db.prepare(
    `INSERT INTO products
       (id, slug, sku, name, catalog_title, category_id, subcategory_id, gender,
        fabric_type, currency, moq, moq_unit, stock, status, featured, source_page,
        data_gaps, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'unisex', ?, ?, ?, ?, 0, 'active', 0, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       catalog_title = excluded.catalog_title,
       category_id = excluded.category_id,
       subcategory_id = excluded.subcategory_id,
       fabric_type = excluded.fabric_type,
       source_page = excluded.source_page,
       data_gaps = excluded.data_gaps,
       updated_at = excluded.updated_at`,
  );
  const findProduct = db.prepare("SELECT id FROM products WHERE slug = ?");
  const insertProductColor = db.prepare(
    `INSERT INTO product_colors (product_id, color_id, secondary_color_id, label, sort_order)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(product_id, color_id) DO NOTHING`,
  );
  const insertProductSector = db.prepare(
    `INSERT INTO product_sectors (product_id, sector_id) VALUES (?, ?)
     ON CONFLICT(product_id, sector_id) DO NOTHING`,
  );
  const countImages = db.prepare(
    "SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?",
  );
  const insertImage = db.prepare(
    `INSERT INTO product_images (id, product_id, url, alt, sort_order, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const p of catalog.products) {
    insertProduct.run(
      p.id,
      p.slug,
      p.sku,
      p.name,
      p.catalogTitle,
      p.category || null,
      p.subcategory || null,
      (p.fabrics ?? []).join(" · ") || null,
      p.currency || "TRY",
      p.moq,
      p.moqUnit,
      p.sourcePage,
      JSON.stringify(p.dataGaps ?? []),
      now,
      now,
    );
    const id = (findProduct.get(p.slug) as { id: string }).id;

    p.colors.forEach((c, i) =>
      insertProductColor.run(id, c.id, c.secondary?.id ?? null, c.label, i),
    );
    for (const s of p.sectors) insertProductSector.run(id, s);

    // Gorseller yalnizca ilk kurulumda yazilir; panelden yapilan siralama korunur.
    if ((countImages.get(id) as { n: number }).n === 0) {
      p.images.forEach((url, i) =>
        insertImage.run(randomUUID(), id, url, p.name, i, i === 0 ? 1 : 0, now),
      );
    }
  }
});

run();

/* --------------------------- ana sayfa afisleri ---------------------- */
/* Slayt ve giris kartlari normalde panelden (/admin/banner) yonetilir; taze
   kurulumda ana sayfanin bos gorunmemesi icin bir baslangic seti yazilir.
   home_banners tablosunda kayit varsa dokunulmaz. */

const bannerCount = db.prepare("SELECT COUNT(*) AS n FROM home_banners").get() as {
  n: number;
};

if (bannerCount.n === 0) {
  const insertBanner = db.prepare(
    `INSERT INTO home_banners
       (id, kind, image_url, eyebrow, title, accent_title, subtitle,
        cta_label, cta_href, cta2_label, cta2_href, sort_order, status,
        created_at, updated_at)
     VALUES
       (@id, @kind, @image_url, @eyebrow, @title, @accent_title, @subtitle,
        @cta_label, @cta_href, @cta2_label, @cta2_href, @sort_order, 'active',
        @now, @now)`,
  );

  const banners = [
    {
      kind: "slide",
      image_url: "/hero/slide-corp.jpg",
      eyebrow: "Kurumsal & endüstriyel",
      title: "Kaliteli iş kıyafeti,",
      accent_title: "kendi markanızla",
      subtitle: null,
      cta_label: "Toptan Teklif Al",
      cta_href: "/teklif",
      cta2_label: "Logo Uygulaması",
      cta2_href: "/logo-uygulama",
      sort_order: 0,
    },
    {
      kind: "slide",
      image_url: "/hero/slide-hivis.jpg",
      eyebrow: "Yüksek görünürlük",
      title: "Sahada güvenlik,",
      accent_title: "her vardiyada",
      subtitle: null,
      cta_label: "Ürünleri Gör",
      cta_href: "/urunler?category=yuksek-gorunurluk",
      cta2_label: null,
      cta2_href: null,
      sort_order: 1,
    },
    {
      kind: "slide",
      image_url: "/hero/slide-3.jpg",
      eyebrow: "Nakış & baskı",
      title: "Personeliniz,",
      accent_title: "logonuzla giyinsin",
      subtitle: null,
      cta_label: "Katalogu İncele",
      cta_href: "/urunler",
      cta2_label: null,
      cta2_href: null,
      sort_order: 2,
    },
    {
      kind: "card",
      image_url: "/hero/card-1.jpg",
      eyebrow: null,
      title: "Hazır Stok & Toptan",
      accent_title: null,
      subtitle: "Katalogdan seçin, adetli sipariş verin",
      cta_label: null,
      cta_href: "/urunler",
      cta2_label: null,
      cta2_href: null,
      sort_order: 0,
    },
    {
      kind: "card",
      image_url: "/hero/card-2.jpg",
      eyebrow: null,
      title: "Kendi Markanı Yarat",
      accent_title: null,
      subtitle: "Nakış ve baskı ile firmanıza özel",
      cta_label: null,
      cta_href: "/logo-uygulama",
      cta2_label: null,
      cta2_href: null,
      sort_order: 1,
    },
    {
      kind: "card",
      image_url: "/hero/card-3.jpg",
      eyebrow: null,
      title: "Numune & Teklif",
      accent_title: null,
      subtitle: "Listenizi gönderin, aynı gün dönelim",
      cta_label: null,
      cta_href: "/teklif",
      cta2_label: null,
      cta2_href: null,
      sort_order: 2,
    },
  ];

  const writeBanners = db.transaction(() => {
    for (const b of banners) {
      insertBanner.run({ id: randomUUID(), now, ...b });
    }
  });
  writeBanners();
  console.log(`[db] ${banners.length} ana sayfa afişi eklendi`);
}

/* --------------------------- super admin ------------------------------ */

const email = (process.env.ADMIN_EMAIL ?? "admin@simatekstil.local").toLowerCase();
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
  | { id: string }
  | undefined;

if (existing) {
  console.log(`[db] super admin zaten var: ${email}`);
} else {
  const password = process.env.ADMIN_PASSWORD ?? `Sima${randomBytes(6).toString("hex")}1`;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, surname, role, status, approved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'super_admin', 'active', ?, ?, ?)`,
  ).run(randomUUID(), email, hashPassword(password), "Sima", "Yönetici", now, now, now);

  console.log("\n[db] Süper admin hesabı oluşturuldu");
  console.log(`     e-posta : ${email}`);
  console.log(`     şifre   : ${password}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("     ^ bu şifre bir daha gösterilmeyecek, kaydedin.\n");
  }
}

const stat = db.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number };
console.log(`[db] seed tamam: ${stat.n} ürün -> ${file}`);
db.close();
