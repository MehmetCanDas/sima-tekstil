import type { Metadata } from "next";
import { asc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { CategoryManager, type CategoryNode } from "./CategoryManager";

export const metadata: Metadata = { title: "Kategoriler" };

export default async function CategoriesPage() {
  await requirePermission("category.read");
  const user = (await getCurrentUser())!;

  // Kategori basina urun sayisi tek alt sorguyla gelir; satir basina sorgu yok.
  const productCount = sql<number>`(
    SELECT COUNT(*) FROM ${products}
    WHERE (${products.categoryId} = ${categories.id}
        OR ${products.subcategoryId} = ${categories.id})
      AND ${products.deletedAt} IS NULL
  )`;

  const rows = db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      parentId: categories.parentId,
      world: categories.world,
      description: categories.description,
      image: categories.image,
      sortOrder: categories.sortOrder,
      status: categories.status,
      seoTitle: categories.seoTitle,
      seoDescription: categories.seoDescription,
      productCount,
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();

  const parents = rows.filter((r) => !r.parentId);
  const tree: CategoryNode[] = parents.map((p) => ({
    ...p,
    children: rows.filter((c) => c.parentId === p.id),
  }));

  // Ust kategorisi arsivlenmis/olmayan kayitlar da gorunmeli.
  const orphans = rows.filter(
    (r) => r.parentId && !parents.some((p) => p.id === r.parentId),
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[26px] font-bold uppercase">Kategoriler</h1>
      <p className="mb-6 text-[13px] text-ink-2">
        Ürün ağacı iki seviyelidir: kategori ve altındaki alt kategoriler. Sıralama
        vitrindeki görünüm sırasını belirler.
      </p>

      <CategoryManager
        tree={tree}
        orphans={orphans}
        allParents={parents.map((p) => ({ id: p.id, name: p.name }))}
        canCreate={user.permissions.has("category.create")}
        canUpdate={user.permissions.has("category.update")}
        canDelete={user.permissions.has("category.delete")}
      />
    </div>
  );
}
