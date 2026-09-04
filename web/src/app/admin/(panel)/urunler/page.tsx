import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/dal";
import { categoryLabels, getFormOptions, listProducts, PAGE_SIZE } from "@/lib/admin/products";
import { getSetting } from "@/lib/admin/settings";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { TableToolbar } from "@/components/admin/TableToolbar";
import { ProductTable } from "./ProductTable";

export const metadata: Metadata = { title: "Ürünler" };

type Search = Record<string, string | undefined>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("product.read");
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const lowStock = Number(await getSetting("low_stock_threshold", 20));

  const options = getFormOptions();
  const cats = categoryLabels(options.categories);

  const { rows, total, page } = listProducts({
    q: params.q,
    status: params.status,
    category: params.category,
    gender: params.gender,
    stock: params.stock,
    featured: params.featured,
    sort: params.sort,
    dir: params.dir,
    page: pageFrom(params.page),
    lowStockThreshold: lowStock,
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">Ürünler</h1>
          <p className="text-[13px] text-muted">
            {total.toLocaleString("tr")} kayıt · stok eşiği {lowStock}
          </p>
        </div>
        {user.permissions.has("product.create") ? (
          <Link href="/admin/urunler/yeni" className="a-btn a-btn-primary">
            Yeni ürün
          </Link>
        ) : null}
      </div>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Ürün adı, SKU veya slug ara…"
          filters={[
            {
              name: "status",
              label: "Durum",
              options: [
                { value: "active", label: "Yayında" },
                { value: "draft", label: "Taslak" },
                { value: "out_of_stock", label: "Stokta yok" },
                { value: "archived", label: "Arşiv" },
              ],
            },
            {
              name: "category",
              label: "Kategori",
              options: cats.map((c) => ({ value: c.id, label: c.label })),
            },
            {
              name: "stock",
              label: "Stok",
              options: [
                { value: "low", label: `Düşük (< ${lowStock})` },
                { value: "out", label: "Tükendi" },
              ],
            },
            {
              name: "gender",
              label: "Cinsiyet",
              options: [
                { value: "unisex", label: "Unisex" },
                { value: "kadin", label: "Kadın" },
                { value: "erkek", label: "Erkek" },
                { value: "cocuk", label: "Çocuk" },
              ],
            },
          ]}
        />

        <ProductTable
          rows={rows}
          categories={cats}
          canUpdate={user.permissions.has("product.update")}
          canDelete={user.permissions.has("product.delete")}
        />

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={params}
          basePath="/admin/urunler"
        />
      </div>
    </div>
  );
}
