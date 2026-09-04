/* ---------------------------------------------------------------------------
 * Gorsel yukleme sinirlari.
 *
 * Server Action'lar istek govdesini tamamen bellege alir; bu yuzden Next'in
 * bir ust siniri vardir (next.config.ts -> serverActions.bodySizeLimit).
 * Buradaki degerler O SINIRIN ALTINDA kalmak zorunda: ustune cikan bir istek
 * daha bizim kodumuza ulasmadan 500 ile reddedilir ve kullanici anlamsiz bir
 * hata gorur.
 *
 * Sunucu tavani 12 MB. Asagidaki toplam 10 MB, aradaki fark multipart
 * govdesinin ek yuku (sinir isaretleri, alan basliklari) icin birakildi.
 *
 * Hem istemci hem sunucu ayni sabitleri kullanir; sunucudaki kontrol
 * belirleyicidir, istemcidekinin tek amaci anlasilir bir mesaj gostermektir.
 * ------------------------------------------------------------------------ */

export const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const ACCEPT_IMAGES = Object.keys(IMAGE_MIME_EXT).join(",");

/** Tek dosya icin ust sinir. */
export const MAX_FILE_BYTES = 6 * 1024 * 1024;

/** Tek istekte gonderilen dosyalarin toplami. */
export const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

/** Urun gorsel sekmesinde tek seferde secilebilecek dosya sayisi. */
export const MAX_FILES_PER_UPLOAD = 10;

export const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / (1024 * 1024));
export const MAX_TOTAL_MB = Math.round(MAX_TOTAL_BYTES / (1024 * 1024));

export type UploadCheck = { ok: true } | { ok: false; error: string };

/** Dosya listesini tur, tekil boyut ve toplam boyut acisindan dogrular. */
export function checkFiles(files: { name: string; size: number; type: string }[]): UploadCheck {
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return {
      ok: false,
      error: `Tek seferde en fazla ${MAX_FILES_PER_UPLOAD} görsel yüklenebilir.`,
    };
  }

  let total = 0;
  for (const file of files) {
    if (!IMAGE_MIME_EXT[file.type]) {
      return { ok: false, error: `Desteklenmeyen dosya türü: ${file.name}` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `${file.name} ${MAX_FILE_MB} MB sınırını aşıyor. Görseli küçültüp tekrar deneyin.`,
      };
    }
    total += file.size;
  }

  if (total > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `Seçilen dosyaların toplamı ${MAX_TOTAL_MB} MB sınırını aşıyor. Daha az dosyayla tekrar deneyin.`,
    };
  }

  return { ok: true };
}
