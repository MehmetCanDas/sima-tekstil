import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { categoryLabels, getFormOptions, getProductDetail } from "@/lib/admin/products";
import { archiveProductAction, updateProductAction } from "@/lib/admin/products.actions";
import { PRODUCT_STATUS, dateTime } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { ProductForm } from "../ProductForm";
import { ImageManager } from "./ImageManager";
import { OptionPicker } from "./OptionPicker";
import { VariantEditor } from "./VariantEditor";
import { ArchiveButton } from "./ArchiveButton";

export const metadata: Metadata = { title: "Ürün düzenle" };

const TABS = [
  { id: "genel", label: "Genel" },
  { id: "gorseller", label: "Görseller" },
  { id: "varyantlar", label: "Renk, beden ve varyantlar" },
] as const;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string }>;
}) {
  await requirePermission("product.read");
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const { tab: rawTab } = await searchParams;

  const detail = getProductDetail(id);
  if (!detail) notFound();

  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : "genel";
  const options = getFormOptions();
  const { product } = detail;
  const canUpdate = user.permissions.has("product.update");

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link href="/admin/urunler" className="text-[13px] text-muted hover:text-ink">
        ← Ürünler
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">{product.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <StatusBadge map={PRODUCT_STATUS} value={product.status} />
            <span className="font-mono">{product.sku ?? "SKU yok"}</span>
            <span>/{product.slug}</span>
            <span>güncellendi {dateTime(product.updatedAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/urun/${product.slug}`}
            target="_blank"
            className="a-btn a-btn-ghost"
          >
            Sitede gör
          </Link>
          {user.permissions.has("product.delete") ? (
            <ArchiveButton
              action={archiveProductAction}
              id={product.id}
              archived={product.status === "archived"}
            />
          ) : null}
        </div>
      </div>

      <nav className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/urunler/${id}?tab=${t.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!canUpdate ? (
        <p className="mb-5 border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
          Bu ürünü görüntüleme yetkiniz var, değiştirme yetkiniz yok.
        </p>
      ) : null}

      {tab === "genel" ? (
        <ProductForm
          action={updateProductAction}
          submitLabel="Değişiklikleri kaydet"
          categories={categoryLabels(options.categories)}
          stockLocked={detail.variants.length > 0}
          values={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            sku: product.sku ?? "",
            categoryId: product.categoryId ?? "",
            subcategoryId: product.subcategoryId ?? "",
            gender: product.gender,
            description: product.description ?? "",
            fabricType: product.fabricType ?? "",
            fabricContent: product.fabricContent ?? "",
            features: safeList(product.features),
            priceMinor: product.priceMinor,
            wholesaleMinor: product.wholesaleMinor,
            wholesaleMinQty: product.wholesaleMinQty,
            currency: product.currency,
            moq: product.moq,
            moqUnit: product.moqUnit ?? "",
            stock: product.stock,
            status: product.status,
            featured: product.featured,
            seoTitle: product.seoTitle ?? "",
            seoDescription: product.seoDescription ?? "",
          }}
        />
      ) : null}

      {tab === "gorseller" ? (
        <ImageManager productId={product.id} images={detail.images} canUpdate={canUpdate} />
      ) : null}

      {tab === "varyantlar" ? (
        <div className="flex flex-col gap-6">
          <OptionPicker
            productId={product.id}
            allColors={options.colors}
            allSizes={options.sizes}
            selectedColorIds={detail.colors.map((c) => c.colorId)}
            selectedSizeIds={detail.sizes.map((s) => s.sizeId)}
            canUpdate={canUpdate}
          />
          <VariantEditor
            productId={product.id}
            variants={detail.variants}
            colors={options.colors}
            sizes={options.sizes}
            currency={product.currency}
            canUpdate={canUpdate}
          />
        </div>
      ) : null}
    </div>
  );
}

/** features alani JSON dizisi olarak saklanir; bozuk veri sayfayi dusurmemeli. */
function safeList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
