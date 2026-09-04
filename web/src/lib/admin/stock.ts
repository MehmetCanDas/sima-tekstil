import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { productVariants, products } from "@/db/schema";

/* ---------------------------------------------------------------------------
 * Stok yazma yolunun tek noktasi.
 *
 * Bugun stok varyantta (varyant yoksa urunde) durur. Ileride cok depolu yapiya
 * gecildiginde yalnizca bu dosya degisir: inventory tablosundan toplanip
 * products.stock onbellek alanina yazilir, cagri yerleri ayni kalir.
 * ------------------------------------------------------------------------ */

/** Varyantlari olan urunun toplam stogunu varyantlardan yeniden hesaplar. */
export function recomputeProductStock(productId: string): void {
  const row = db
    .select({
      n: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)`,
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)))
    .get();

  // Varyant yoksa urunun kendi stok alani gecerlidir; uzerine yazmayiz.
  if (!row || row.n === 0) return;

  db.update(products)
    .set({ stock: row.total, updatedAt: Date.now() })
    .where(eq(products.id, productId))
    .run();
}

/** Urunun varyanti var mi? Stok alaninin duzenlenebilir olup olmadigini belirler. */
export function hasVariants(productId: string): boolean {
  const row = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)))
    .get();
  return (row?.n ?? 0) > 0;
}
