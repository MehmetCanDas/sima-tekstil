"use client";

import { Img as Image } from "@/components/Img";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { ProductListRow } from "@/lib/admin/products";
import { bulkProductAction } from "@/lib/admin/products.actions";
import { PRODUCT_STATUS, dateTime, money } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { SortLink } from "@/components/admin/TableToolbar";
import { ActionForm, ConfirmSubmit, EmptyState, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Urun tablosu ve toplu islem cubugu.
 *
 * Secim istemcide tutulur ama islenen kimlikler forma gizli alan olarak
 * yazilir; sunucu yalnizca gonderilen listeyi ve yetkiyi dikkate alir.
 * ------------------------------------------------------------------------ */

type Cat = { id: string; label: string };

export function ProductTable({
  rows,
  categories,
  canUpdate,
  canDelete,
}: {
  rows: ProductListRow[];
  categories: Cat[];
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Ürün bulunamadı"
        body="Arama ve filtreleri değiştirmeyi deneyin ya da yeni bir ürün ekleyin."
      />
    );
  }

  return (
    <>
      {selected.size > 0 && (canUpdate || canDelete) ? (
        <BulkBar
          ids={ids}
          categories={categories}
          canDelete={canDelete}
          onDone={() => setSelected(new Set())}
        />
      ) : null}

      <div className="overflow-x-auto">
        <table className="a-table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-9">
                <input
                  type="checkbox"
                  aria-label="Sayfadaki tüm ürünleri seç"
                  checked={allOnPage}
                  onChange={toggleAll}
                />
              </th>
              <th className="w-14">Görsel</th>
              <th>
                <SortLink column="name" label="Ürün" />
              </th>
              <th>
                <SortLink column="sku" label="SKU" />
              </th>
              <th>Kategori</th>
              <th className="text-right">
                <SortLink column="price" label="Fiyat" />
              </th>
              <th className="text-right">
                <SortLink column="stock" label="Stok" />
              </th>
              <th>
                <SortLink column="status" label="Durum" />
              </th>
              <th className="text-right">
                <SortLink column="updated" label="Güncellendi" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-selected={selected.has(r.id)}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${r.name} seç`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td>
                  {r.image ? (
                    <Image
                      src={r.image}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 border border-line object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center border border-line bg-surface text-[10px] text-muted">
                      yok
                    </div>
                  )}
                </td>
                <td>
                  <Link
                    href={`/admin/urunler/${r.id}`}
                    className="font-semibold hover:text-accent"
                  >
                    {r.name}
                  </Link>
                  <div className="flex items-center gap-2 text-[12px] text-muted">
                    <span>/{r.slug}</span>
                    {r.featured ? <span className="text-accent">★ öne çıkan</span> : null}
                    {r.variantCount > 0 ? <span>{r.variantCount} varyant</span> : null}
                  </div>
                </td>
                <td className="font-mono text-[12px]">{r.sku ?? "—"}</td>
                <td className="text-[12px]">{r.categoryName ?? "—"}</td>
                <td className="whitespace-nowrap text-right tabular-nums">
                  {money(r.priceMinor, r.currency)}
                  {r.wholesaleMinor !== null ? (
                    <div className="text-[11px] text-muted">
                      toptan {money(r.wholesaleMinor, r.currency)}
                    </div>
                  ) : null}
                </td>
                <td
                  className={`text-right tabular-nums ${r.stock === 0 ? "text-[#b3261e]" : ""}`}
                >
                  {r.stock.toLocaleString("tr")}
                </td>
                <td>
                  <StatusBadge map={PRODUCT_STATUS} value={r.status} />
                </td>
                <td className="whitespace-nowrap text-right text-[12px] text-muted">
                  {dateTime(r.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------ toplu islem ----------------------------- */

const OPS = [
  { value: "status", label: "Durumu değiştir" },
  { value: "category", label: "Kategoriyi değiştir" },
  { value: "price", label: "Liste fiyatını ayarla" },
  { value: "wholesale", label: "Toptan fiyatı ayarla" },
  { value: "stock", label: "Stoğu ayarla" },
  { value: "discount", label: "Yüzde indirim uygula" },
  { value: "featured", label: "Öne çıkarma" },
] as const;

function BulkBar({
  ids,
  categories,
  canDelete,
  onDone,
}: {
  ids: string[];
  categories: Cat[];
  canDelete: boolean;
  onDone: () => void;
}) {
  const [op, setOp] = useState<string>("status");

  return (
    <ActionForm
      action={bulkProductAction}
      onSuccess={onDone}
      className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-4 py-3"
    >
      {() => (
        <>
          {ids.map((id) => (
            <input key={id} type="hidden" name="selected" value={id} />
          ))}

          <strong className="text-[13px]">{ids.length} ürün seçildi</strong>

          <select
            name="op"
            className="a-select w-auto"
            aria-label="Toplu işlem"
            value={op}
            onChange={(e) => setOp(e.target.value)}
          >
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <ValueInput op={op} categories={categories} />

          <SubmitButton className="a-btn a-btn-primary a-btn-sm" pendingText="Uygulanıyor…">
            Uygula
          </SubmitButton>

          {canDelete ? (
            <ConfirmSubmit
              className="a-btn a-btn-danger a-btn-sm"
              title="Seçili ürünler arşive alınsın mı?"
              body={`${ids.length} ürün arşive alınacak. Kayıtlar silinmez; arşiv filtresinden geri getirebilirsiniz.`}
              confirmLabel="Arşive al"
              name="archive"
              value="1"
            >
              Arşive al
            </ConfirmSubmit>
          ) : null}

          <button
            type="button"
            className="a-btn a-btn-ghost a-btn-sm ml-auto"
            onClick={onDone}
          >
            Seçimi temizle
          </button>
        </>
      )}
    </ActionForm>
  );
}

function ValueInput({ op, categories }: { op: string; categories: Cat[] }) {
  if (op === "status") {
    return (
      <select name="value" className="a-select w-auto" aria-label="Yeni durum">
        <option value="active">Yayında</option>
        <option value="draft">Taslak</option>
        <option value="out_of_stock">Stokta yok</option>
        <option value="archived">Arşiv</option>
      </select>
    );
  }
  if (op === "category") {
    return (
      <select name="value" className="a-select w-auto" aria-label="Yeni kategori">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    );
  }
  if (op === "featured") {
    return (
      <select name="value" className="a-select w-auto" aria-label="Öne çıkarma">
        <option value="1">Öne çıkar</option>
        <option value="0">Kaldır</option>
      </select>
    );
  }
  if (op === "discount") {
    return (
      <input
        name="value"
        className="a-input w-[130px]"
        type="number"
        min={1}
        max={99}
        placeholder="% indirim"
        aria-label="İndirim oranı"
        required
      />
    );
  }
  if (op === "stock") {
    return (
      <input
        name="value"
        className="a-input w-[130px]"
        type="number"
        min={0}
        placeholder="Yeni stok"
        aria-label="Yeni stok"
        required
      />
    );
  }
  return (
    <input
      name="value"
      className="a-input w-[150px]"
      inputMode="decimal"
      placeholder="Örn. 249,90"
      aria-label="Yeni fiyat"
      required
    />
  );
}
