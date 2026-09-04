/* ---------------------------------------------------------------------------
 * Adet kademeli fiyatlandirma.
 *
 * Bir urunde iki fiyat olabilir:
 *   listPrice      — birim fiyat
 *   wholesalePrice — belirli bir adetten sonra gecerli olan toptan birim fiyat
 *
 * Toptan fiyat yalnizca "wholesaleMinQty" adedine ULASILDIGINDA uygulanir.
 * Ornek: liste 300 TL, toptan 250 TL, esik 40 adet.
 *   20 adet -> 20 x 300 = 6.000 TL
 *   40 adet -> 40 x 250 = 10.000 TL
 *
 * Bu dosya hem vitrinde (istemci) hem sunucuda kullanilir; tek bir kural
 * olmasi, ekranda gorunen fiyat ile kaydedilen fiyatin ayrismasini onler.
 * ------------------------------------------------------------------------ */

export type PriceInput = {
  /** Liste fiyati, kurus. */
  priceMinor: number | null;
  /** Toptan birim fiyat, kurus. */
  wholesaleMinor: number | null;
  /** Toptan fiyatin gecerli oldugu en dusuk adet. */
  wholesaleMinQty: number | null;
};

export type PriceResult = {
  /** Bu adette gecerli birim fiyat. Fiyat tanimli degilse null. */
  unitMinor: number | null;
  /** Satir toplami. */
  totalMinor: number | null;
  /** Toptan kademe uygulandi mi? */
  wholesaleApplied: boolean;
  /** Toptan fiyat tanimli ama esige ulasilmadiysa kalan adet. */
  qtyToWholesale: number | null;
  /** Toptan kademede birim basina kazanc, kurus. */
  savingPerUnitMinor: number | null;
};

/** Urunde gecerli bir toptan kademe tanimli mi? */
export function hasWholesaleTier(p: PriceInput): boolean {
  return (
    p.wholesaleMinor !== null &&
    p.wholesaleMinor > 0 &&
    p.wholesaleMinQty !== null &&
    p.wholesaleMinQty > 1
  );
}

/** Verilen adet icin gecerli birim fiyati ve toplami hesaplar. */
export function priceFor(p: PriceInput, qty: number): PriceResult {
  const amount = Math.max(0, Math.floor(qty) || 0);
  const tier = hasWholesaleTier(p);
  const threshold = tier ? p.wholesaleMinQty! : null;
  const applied = tier && amount >= threshold!;

  // Toptan kademe yoksa liste fiyati; liste fiyati da yoksa fiyat gosterilmez.
  const unitMinor = applied ? p.wholesaleMinor! : p.priceMinor;

  return {
    unitMinor,
    totalMinor: unitMinor === null ? null : unitMinor * amount,
    wholesaleApplied: applied,
    qtyToWholesale: tier && !applied ? threshold! - amount : null,
    savingPerUnitMinor:
      tier && p.priceMinor !== null && p.priceMinor > p.wholesaleMinor!
        ? p.priceMinor - p.wholesaleMinor!
        : null,
  };
}

/** Vitrinde gosterilecek en dusuk birim fiyat (toptan varsa o). */
export function lowestUnitMinor(p: PriceInput): number | null {
  if (hasWholesaleTier(p) && p.priceMinor !== null) {
    return Math.min(p.priceMinor, p.wholesaleMinor!);
  }
  return p.priceMinor ?? p.wholesaleMinor ?? null;
}
