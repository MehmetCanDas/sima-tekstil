import NextImage, { type ImageProps } from "next/image";

/* ---------------------------------------------------------------------------
 * next/image sarmalayicisi.
 *
 * Panelden yuklenen gorseller (/uploads/...) icin optimizasyon proxy'si
 * (_next/image) DEVRE DISI birakilir: `next start` public/ klasorunu yalnizca
 * sunucu acilirken tarar, sonradan yuklenen dosyalari "yok" sayip kirik
 * gosteriyordu. Bu gorseller Nginx tarafindan dogrudan diskten servis edilir
 * (bkz. nginx: `location /uploads/`).
 *
 * Katalog, hero, marka gorselleri build ile geldigi icin eskisi gibi
 * optimize edilmeye devam eder.
 * ------------------------------------------------------------------------ */

export function Img(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const isUpload = src.startsWith("/uploads/");
  return <NextImage {...props} unoptimized={isUpload || props.unoptimized} />;
}
