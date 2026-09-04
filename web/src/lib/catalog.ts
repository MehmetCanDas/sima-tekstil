import raw from "@/data/catalog.json";

/* ---------------------------------------------------------------------------
 * Katalogdan cikarilan sabit veriler.
 *
 * DIKKAT: urun/kategori/renk verisinin kaynagi artik BURASI DEGIL, veritabani.
 * Vitrin src/lib/storefront.ts uzerinden okur, panel de ayni tablolari yazar.
 * catalog.json yalnizca iki isi kaldi:
 *   1. Ilk kurulum verisi (npm run db:seed)
 *   2. Firma bilgileri (marka adi, adres, telefon) - henuz panelde duzenlenmiyor
 *
 * Urun sorgularinin buradan kaldirilmasinin sebebi: iki ayri kaynak vardi ve
 * panelde yapilan degisiklikler vitrine hic yansimiyordu.
 * ------------------------------------------------------------------------ */

export type Brand = {
  name: string;
  tagline: string;
  owner: string;
  ownerTitle: string;
  phone: string;
  phoneRaw: string;
  email: string;
  instagram: string;
  address: string;
  city: string;
  /** Katalogda bulunmayan, yayina cikmadan once gereken yasal bilgiler. */
  missing: string[];
};

type CatalogData = { brand: Brand };

export const brand = (raw as unknown as CatalogData).brand;

/** Vitrindeki ust seviye ayrim. Kategoriler bu iki dunyadan birine baglidir. */
export const WORLDS = [
  { id: "is-kiyafetleri", name: "İş Kıyafetleri" },
  { id: "promosyon", name: "Promosyon" },
] as const;

/** Katalogda bulunmayan, firmadan beklenen alanlar (panel: Veri Durumu). */
export type DataGap =
  | "sku"
  | "fiyat"
  | "beden"
  | "stok"
  | "moq"
  | "renk"
  | "sertifika"
  | "urun-ayrimi";

export const GAP_LABEL: Record<DataGap, string> = {
  sku: "Ürün kodu",
  fiyat: "Fiyat",
  beden: "Beden",
  stok: "Stok",
  moq: "Min. sipariş",
  renk: "Renk",
  sertifika: "Sertifika",
  "urun-ayrimi": "Ürün ayrımı",
};
