import type { MetadataRoute } from "next";
import { getPublishedProducts, getStoreCategories } from "@/lib/storefront";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/urunler`, priority: 0.9 },
    { url: `${BASE}/logo-uygulama`, priority: 0.7 },
    { url: `${BASE}/iletisim`, priority: 0.5 },
    ...getStoreCategories().map((c) => ({ url: `${BASE}/urunler?category=${c.id}`, priority: 0.8 })),
    ...getPublishedProducts().map((p) => ({ url: `${BASE}/urun/${p.slug}`, priority: 0.8 })),
  ];
}
