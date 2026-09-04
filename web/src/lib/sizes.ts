/* ---------------------------------------------------------------------------
 * Beden olcekleri.
 *
 * Katalogda uc farkli durum var ve hepsine ayni beden listesini dayatmak
 * yanlis olurdu:
 *   apparel — giyim: S / M / L / XL / XXL / XXXL
 *   shoe    — is ayakkabisi: numara
 *   none    — aksesuar ve promosyon (kalem, ajanda, kupa...): tek beden
 *
 * Bu dosya hem istemci hem sunucu tarafindan kullanilir: teklif listesi
 * dagilimi burada dogrular, API de ayni kurali kendi tarafinda tekrar uygular.
 * ------------------------------------------------------------------------ */

export const SIZE_SCALES = {
  apparel: ["S", "M", "L", "XL", "XXL", "XXXL"],
  shoe: ["39", "40", "41", "42", "43", "44", "45", "46"],
} as const;

export type SizeScaleId = keyof typeof SIZE_SCALES | "none";
export type SizeBreakdown = Record<string, number>;

/** Kategori -> beden olcegi. */
const CATEGORY_SCALE: Record<string, SizeScaleId> = {
  "ust-giyim": "apparel",
  "alt-giyim": "apparel",
  yelek: "apparel",
  tulum: "apparel",
  "yuksek-gorunurluk": "apparel",
  yagmurluk: "apparel",
  "meslek-setleri": "apparel",
  spor: "apparel",
  ayakkabi: "shoe",
  aksesuar: "none",
  promosyon: "none",
};

/**
 * Bilinmeyen kategori giyim sayilir: yeni bir giyim kategorisi eklendiginde
 * beden zorunlulugunun sessizce atlanmasi, yeni bir aksesuar kategorisinde
 * gereksiz beden istenmesinden daha kotu bir hata olurdu.
 */
export function sizeScaleFor(categoryId: string | null | undefined): SizeScaleId {
  if (!categoryId) return "apparel";
  return CATEGORY_SCALE[categoryId] ?? "apparel";
}

export function sizeKeys(scale: SizeScaleId): readonly string[] {
  return scale === "none" ? [] : SIZE_SCALES[scale];
}

export function scaleLabel(scale: SizeScaleId): string {
  if (scale === "shoe") return "Numara dağılımı";
  if (scale === "none") return "Tek beden";
  return "Beden dağılımı";
}

/** Dagitilmis toplam adet. Olcege ait olmayan anahtarlar sayilmaz. */
export function sizeTotal(sizes: SizeBreakdown, scale: SizeScaleId): number {
  return sizeKeys(scale).reduce((sum, key) => sum + (sizes[key] ?? 0), 0);
}

/** Toplami bedenlere olabildigince esit bolen dagilim. */
export function evenBreakdown(total: number, scale: SizeScaleId): SizeBreakdown {
  const keys = sizeKeys(scale);
  const out: SizeBreakdown = {};
  if (total <= 0 || keys.length === 0) return out;

  const base = Math.floor(total / keys.length);
  let extra = total - base * keys.length;
  for (const key of keys) {
    // Artan adetler bastan dagitilir; toplam her zaman tam tutar.
    const value = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    if (value > 0) out[key] = value;
  }
  return out;
}

/** Istemciden gelen ham dagilimi olcege gore temizler. */
export function sanitizeBreakdown(raw: unknown, scale: SizeScaleId): SizeBreakdown {
  const out: SizeBreakdown = {};
  if (!raw || typeof raw !== "object") return out;
  const source = raw as Record<string, unknown>;
  for (const key of sizeKeys(scale)) {
    const value = Math.floor(Number(source[key]) || 0);
    if (value > 0) out[key] = Math.min(1_000_000, value);
  }
  return out;
}
