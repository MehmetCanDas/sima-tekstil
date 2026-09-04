import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { colors, customerEvents, productColors, products, quoteItems, quotes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { sanitizeBreakdown, sizeScaleFor, sizeTotal } from "@/lib/sizes";
import { priceFor } from "@/lib/pricing";

/* ---------------------------------------------------------------------------
 * Teklif talebi ucu.
 *
 * Talep veritabanina yazilir ve panelin Teklifler ekraninda "Yeni" durumunda
 * gorunur. Urun adi, renk ve fiyat istemciden gelen degerlerle degil, sunucudaki
 * urun kaydiyla doldurulur; istemci yalnizca slug, renk kimligi ve adet gonderir.
 *
 * TODO(bildirim): teklif olusunca satis ekibine e-posta gonderilecek. E-posta
 * servisi kurulana kadar talep yalnizca panelde gorunur.
 * ------------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

type Line = {
  slug: string;
  colorId: string | null;
  qty: number;
  sizes?: Record<string, number>;
};

function quoteCode(): string {
  const d = new Date();
  const stamp = `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 50; i++) {
    const candidate = `TK-${stamp}-${Math.floor(Math.random() * 9000) + 1000}`;
    const hit = db.select({ id: quotes.id }).from(quotes).where(eq(quotes.code, candidate)).get();
    if (!hit) return candidate;
  }
  return `TK-${stamp}-${Date.now().toString().slice(-6)}`;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Çok fazla deneme. Bir dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Honeypot doluysa bot: basarili gibi cevapla, hicbir sey yapma.
  if (typeof b.website === "string" && b.website.length > 0) {
    return NextResponse.json({ ok: true, reference: quoteCode() });
  }

  const company = String(b.company ?? "").trim();
  const contact = String(b.contact ?? "").trim();
  const email = String(b.email ?? "").trim();
  const phone = String(b.phone ?? "").trim();
  const note = String(b.note ?? "").trim().slice(0, 2000);
  const city = String(b.city ?? "").trim().slice(0, 100);

  const problems: string[] = [];
  if (company.length < 2 || company.length > 200) problems.push("firma adı");
  if (contact.length < 2 || contact.length > 200) problems.push("yetkili kişi");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("e-posta");
  if (phone.replace(/\D/g, "").length < 10) problems.push("telefon");

  const rawLines = Array.isArray(b.lines) ? (b.lines as Line[]) : [];

  // Urun ve adet sunucuda dogrulanir; istemciden gelen ada guvenilmez.
  const resolved = rawLines
    .map((l) => ({
      slug: String(l?.slug ?? ""),
      colorId: l?.colorId ? String(l.colorId) : null,
      qty: Math.min(1_000_000, Math.max(1, Math.floor(Number(l?.qty) || 0))),
      rawSizes: l?.sizes,
    }))
    .slice(0, 200)
    .map((l) => {
      const product = db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          categoryId: products.categoryId,
          priceMinor: products.priceMinor,
          wholesaleMinor: products.wholesaleMinor,
          wholesaleMinQty: products.wholesaleMinQty,
          currency: products.currency,
        })
        .from(products)
        .where(and(eq(products.slug, l.slug), isNull(products.deletedAt)))
        .get();
      if (!product) return null;

      // Renk yalnizca urune gercekten tanimliysa kabul edilir.
      const color = l.colorId
        ? db
            .select({ id: colors.id, name: colors.name })
            .from(productColors)
            .innerJoin(colors, eq(colors.id, productColors.colorId))
            .where(
              and(
                eq(productColors.productId, product.id),
                eq(productColors.colorId, l.colorId),
              ),
            )
            .get()
        : null;

      // Beden olcegi urunun kendi kategorisinden belirlenir; istemcinin
      // gonderdigi olcege guvenilmez.
      const scale = sizeScaleFor(product.categoryId);
      const sizes = sanitizeBreakdown(l.rawSizes, scale);

      // Fiyat istemciden degil urun kaydindan hesaplanir. Toptan kademe satirin
      // TOPLAM adedine gore belirlenir; bedenlere bolunmesi kademeyi dusurmez.
      const price = priceFor(product, l.qty);

      return { product, color, qty: l.qty, scale, sizes, unitMinor: price.unitMinor };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (resolved.length === 0) problems.push("ürün listesi");

  if (problems.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Eksik veya hatalı alan: ${problems.join(", ")}` },
      { status: 422 },
    );
  }

  // Beden dagilimi kurali sunucuda tekrar dogrulanir: istemcideki kontrol
  // yalnizca kullanici deneyimi icindir, gecerlilik burada belirlenir.
  const unbalanced = resolved.filter(
    (l) => l.scale !== "none" && sizeTotal(l.sizes, l.scale) !== l.qty,
  );
  if (unbalanced.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Beden dağılımı toplam adetle eşleşmiyor: ${unbalanced
          .map((l) => l.product.name)
          .join(", ")}.`,
      },
      { status: 422 },
    );
  }

  // Oturum acik bir B2B kullanicisi ise talep hesabina baglanir.
  const user = await getCurrentUser();
  const quoteId = randomUUID();
  const code = quoteCode();

  db.transaction((tx) => {
    tx.insert(quotes)
      .values({
        id: quoteId,
        code,
        companyId: user?.companyId ?? null,
        userId: user?.id ?? null,
        companyName: company,
        contactName: contact,
        email,
        phone,
        city: city || null,
        note: note || null,
        status: "new",
        sourceIp: ip,
      })
      .run();

    for (const line of resolved) {
      // Her beden ayri bir teklif kalemi olur: uretim ve fiyatlama beden
      // bazinda planlandigi icin panelde de bu ayrimla gorunmesi gerekir.
      const rows =
        line.scale === "none"
          ? [{ sizeName: null as string | null, qty: line.qty }]
          : Object.entries(line.sizes).map(([sizeName, qty]) => ({ sizeName, qty }));

      for (const row of rows) {
        tx.insert(quoteItems)
          .values({
            id: randomUUID(),
            quoteId,
            productId: line.product.id,
            colorId: line.color?.id ?? null,
            name: line.product.name,
            sku: line.product.sku,
            colorName: line.color?.name ?? null,
            sizeName: row.sizeName,
            qty: row.qty,
            quotedPriceMinor: line.unitMinor,
          })
          .run();
      }
    }

    // Teklif toplami: fiyati tanimli kalemlerin toplami. Fiyatsiz urunlerde
    // satis ekibi fiyati panelde girer.
    const total = resolved.reduce(
      (sum, l) => sum + (l.unitMinor === null ? 0 : l.unitMinor * l.qty),
      0,
    );
    if (total > 0) {
      tx.update(quotes).set({ totalMinor: total }).where(eq(quotes.id, quoteId)).run();
    }

    if (user) {
      tx.insert(customerEvents)
        .values({
          id: randomUUID(),
          userId: user.id,
          companyId: user.companyId,
          type: "quote_request",
          meta: JSON.stringify({
            code,
            lines: resolved.length,
            qty: resolved.reduce((sum, l) => sum + l.qty, 0),
          }),
        })
        .run();
    }
  });

  return NextResponse.json({ ok: true, reference: code });
}
