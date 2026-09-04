/* ---------------------------------------------------------------------------
 * Bicimlendirme ve durum etiketleri.
 * Hem sunucu hem istemci bilesenlerinden kullanilir; yan etkisi yoktur.
 * ------------------------------------------------------------------------ */

export const PRODUCT_STATUS = {
  active: { label: "Yayında", tone: "ok" },
  draft: { label: "Taslak", tone: "mute" },
  out_of_stock: { label: "Stokta yok", tone: "warn" },
  archived: { label: "Arşiv", tone: "mute" },
} as const;

export const ACCOUNT_STATUS = {
  pending: { label: "Onay bekliyor", tone: "warn" },
  active: { label: "Aktif", tone: "ok" },
  suspended: { label: "Askıda", tone: "bad" },
  rejected: { label: "Reddedildi", tone: "bad" },
  archived: { label: "Arşiv", tone: "mute" },
} as const;

export const ORDER_STATUS = {
  pending: { label: "Bekliyor", tone: "warn" },
  confirmed: { label: "Onaylandı", tone: "ok" },
  processing: { label: "Hazırlanıyor", tone: "ok" },
  ready_to_ship: { label: "Sevke hazır", tone: "ok" },
  shipped: { label: "Kargoda", tone: "ok" },
  delivered: { label: "Teslim edildi", tone: "ok" },
  cancelled: { label: "İptal", tone: "bad" },
} as const;

export const QUOTE_STATUS = {
  new: { label: "Yeni", tone: "warn" },
  in_review: { label: "İnceleniyor", tone: "warn" },
  quoted: { label: "Teklif verildi", tone: "ok" },
  accepted: { label: "Kabul edildi", tone: "ok" },
  rejected: { label: "Reddedildi", tone: "bad" },
  expired: { label: "Süresi doldu", tone: "mute" },
  converted: { label: "Siparişe döndü", tone: "ok" },
} as const;

export const GENDERS = {
  unisex: "Unisex",
  kadin: "Kadın",
  erkek: "Erkek",
  cocuk: "Çocuk",
} as const;

type Tone = "ok" | "warn" | "bad" | "mute";

export function statusOf(
  map: Record<string, { label: string; tone: string }>,
  key: string,
): { label: string; tone: Tone } {
  const hit = map[key];
  return hit ? { label: hit.label, tone: hit.tone as Tone } : { label: key, tone: "mute" };
}

/** Kurus -> "1.234,50 ₺". Bos deger tire doner. */
export function money(minor: number | null | undefined, currency = "TRY"): string {
  if (minor === null || minor === undefined) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Form girdisi ("1.234,50" veya "1234.5") -> kurus. Bos ise null. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (raw === "") return null;
  // Turkce girdi: binlik nokta, ondalik virgul. Ikisi de destekleniyor.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/\s/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Kurus -> form alanina yazilabilir "1234.50". */
export function moneyInput(minor: number | null | undefined): string {
  return minor === null || minor === undefined ? "" : (minor / 100).toFixed(2);
}

export function dateTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function dateOnly(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(ms));
}

export function relative(ms: number | null | undefined): string {
  if (!ms) return "—";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(diff / size), unit);
  }
  return "az önce";
}

/** Turkce karakterleri de dogru ceviren slug uretici. */
export function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
