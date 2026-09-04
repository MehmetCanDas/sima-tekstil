import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { categoryLabels, getFormOptions } from "@/lib/admin/products";
import { getSetting } from "@/lib/admin/settings";
import { createProductAction } from "@/lib/admin/products.actions";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Yeni ürün" };

export default async function NewProductPage() {
  await requirePermission("product.create");
  const options = getFormOptions();
  const currency = String(await getSetting("default_currency", "TRY"));
  const moqUnit = String(await getSetting("default_moq_unit", "adet"));

  return (
    <div className="mx-auto max-w-[900px]">
      <Link href="/admin/urunler" className="text-[13px] text-muted hover:text-ink">
        ← Ürünler
      </Link>
      <h1 className="mb-1 mt-2 text-[26px] font-bold uppercase">Yeni ürün</h1>
      <p className="mb-6 text-[13px] text-ink-2">
        Görselleri bu formdan yükleyebilirsiniz. Durumu &ldquo;Yayında&rdquo; bırakırsanız
        ürün kaydettiğiniz anda sitede görünür. Renk, beden ve varyantlar ürün
        oluşturulduktan sonra eklenir.
      </p>

      <ProductForm
        action={createProductAction}
        submitLabel="Ürünü oluştur"
        withImages
        categories={categoryLabels(options.categories)}
        values={{
          name: "",
          slug: "",
          sku: "",
          categoryId: "",
          subcategoryId: "",
          gender: "unisex",
          description: "",
          fabricType: "",
          fabricContent: "",
          features: [],
          priceMinor: null,
          wholesaleMinor: null,
          wholesaleMinQty: null,
          currency,
          moq: null,
          moqUnit,
          stock: 0,
          status: "active",
          featured: false,
          seoTitle: "",
          seoDescription: "",
        }}
      />
    </div>
  );
}
