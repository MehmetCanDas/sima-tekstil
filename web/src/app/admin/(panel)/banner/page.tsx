import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { db } from "@/db";
import { homeBanners } from "@/db/schema";
import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { BannerManager } from "./BannerManager";

export const metadata: Metadata = { title: "Ana sayfa görselleri" };

export default async function BannerPage() {
  await requirePermission("banner.read");
  const me = (await getCurrentUser())!;

  const rows = db
    .select()
    .from(homeBanners)
    .orderBy(asc(homeBanners.kind), asc(homeBanners.sortOrder))
    .all();

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[26px] font-bold uppercase">Ana sayfa görselleri</h1>
      <p className="mb-6 max-w-[75ch] text-[13px] text-ink-2">
        Ana sayfanın en üstündeki kayan slaytlar ve hemen altındaki üç giriş kartı
        buradan yönetilir. Değişiklikler kaydedildiği anda sitede görünür.
      </p>

      <BannerManager
        slides={rows.filter((r) => r.kind === "slide")}
        cards={rows.filter((r) => r.kind === "card")}
        canEdit={me.permissions.has("banner.update")}
      />
    </div>
  );
}
