"use client";

import {
  deleteVariantAction,
  generateVariantsAction,
  saveVariantsAction,
} from "@/lib/admin/products.actions";
import { moneyInput } from "@/lib/admin/format";
import { ActionForm, EmptyState, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Varyant tablosu: her Renk x Beden kombinasyonu icin SKU, stok ve fiyat.
 *
 * Tablonun tamami tek formda kaydedilir; satir satir istek atmak 40 varyantli
 * bir uruse 40 yazma demek olurdu. Fiyat bos birakilirsa urun fiyati gecerlidir.
 * ------------------------------------------------------------------------ */

type Variant = {
  id: string;
  colorId: string | null;
  sizeId: string | null;
  sku: string;
  stock: number;
  priceMinor: number | null;
  status: string;
};

export function VariantEditor({
  productId,
  variants,
  colors,
  sizes,
  currency,
  canUpdate,
}: {
  productId: string;
  variants: Variant[];
  colors: { id: string; name: string; hex: string }[];
  sizes: { id: string; name: string; sortOrder: number }[];
  currency: string;
  canUpdate: boolean;
}) {
  const colorById = new Map(colors.map((c) => [c.id, c]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));

  // Renk sonra beden sirasi: tablo katalogdaki okuma duzenini izler.
  const rows = [...variants].sort((a, b) => {
    const ca = colorById.get(a.colorId ?? "")?.name ?? "";
    const cb = colorById.get(b.colorId ?? "")?.name ?? "";
    if (ca !== cb) return ca.localeCompare(cb, "tr");
    const sa = sizeById.get(a.sizeId ?? "")?.sortOrder ?? 0;
    const sb = sizeById.get(b.sizeId ?? "")?.sortOrder ?? 0;
    return sa - sb;
  });

  const totalStock = rows.reduce((sum, v) => sum + v.stock, 0);

  return (
    <section className="a-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Varyantlar ({rows.length})
          </h2>
          <p className="text-[12px] text-muted">
            Toplam stok {totalStock.toLocaleString("tr")} · fiyatı boş varyantlar ürün
            fiyatını kullanır
          </p>
        </div>
        {canUpdate ? (
          <ActionForm action={generateVariantsAction}>
            {() => (
              <>
                <input type="hidden" name="id" value={productId} />
                <SubmitButton className="a-btn a-btn-ghost" pendingText="Üretiliyor…">
                  Eksik kombinasyonları üret
                </SubmitButton>
              </>
            )}
          </ActionForm>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Varyant yok"
          body="Yukarıdan renk ve beden seçip “Eksik kombinasyonları üret” düğmesine basın. Her kombinasyon için ayrı SKU, stok ve fiyat tanımlayabilirsiniz."
        />
      ) : (
        <ActionForm action={saveVariantsAction} successMessage="Varyantlar kaydedildi.">
          {(state) => {
            const err = (field: string) =>
              state && !state.ok ? state.fieldErrors?.[field] : undefined;

            return (
              <>
                <input type="hidden" name="id" value={productId} />
                <div className="overflow-x-auto">
                  <table className="a-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Renk</th>
                        <th>Beden</th>
                        <th>SKU</th>
                        <th className="text-right">Stok</th>
                        <th className="text-right">Fiyat ({currency})</th>
                        <th>Durum</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((v) => {
                        const color = colorById.get(v.colorId ?? "");
                        const size = sizeById.get(v.sizeId ?? "");
                        const skuError = err(`sku_${v.id}`);
                        return (
                          <tr key={v.id}>
                            <td className="whitespace-nowrap">
                              <input type="hidden" name="variantId" value={v.id} />
                              <span className="inline-flex items-center gap-2">
                                <span
                                  aria-hidden
                                  className="h-3.5 w-3.5 border border-line-strong"
                                  style={{ background: color?.hex ?? "#ddd" }}
                                />
                                {color?.name ?? "—"}
                              </span>
                            </td>
                            <td className="font-semibold">{size?.name ?? "—"}</td>
                            <td>
                              <input
                                name={`sku_${v.id}`}
                                defaultValue={v.sku}
                                className="a-input font-mono text-[12px]"
                                aria-label={`${color?.name ?? ""} ${size?.name ?? ""} SKU`}
                                aria-invalid={skuError ? "true" : undefined}
                                disabled={!canUpdate}
                                maxLength={60}
                              />
                              {skuError ? <p className="a-error">{skuError}</p> : null}
                            </td>
                            <td>
                              <input
                                name={`stock_${v.id}`}
                                type="number"
                                min={0}
                                defaultValue={v.stock}
                                className="a-input w-[92px] text-right tabular-nums"
                                aria-label={`${color?.name ?? ""} ${size?.name ?? ""} stok`}
                                disabled={!canUpdate}
                              />
                            </td>
                            <td>
                              <input
                                name={`price_${v.id}`}
                                inputMode="decimal"
                                defaultValue={moneyInput(v.priceMinor)}
                                placeholder="ürün fiyatı"
                                className="a-input w-[118px] text-right tabular-nums"
                                aria-label={`${color?.name ?? ""} ${size?.name ?? ""} fiyat`}
                                disabled={!canUpdate}
                              />
                            </td>
                            <td>
                              <select
                                name={`status_${v.id}`}
                                defaultValue={v.status}
                                className="a-select w-auto"
                                aria-label="Varyant durumu"
                                disabled={!canUpdate}
                              >
                                <option value="active">Aktif</option>
                                <option value="inactive">Pasif</option>
                              </select>
                            </td>
                            <td className="text-right">
                              {canUpdate ? (
                                <button
                                  type="submit"
                                  form={`variant-delete-${v.id}`}
                                  className="a-btn a-btn-danger a-btn-sm"
                                >
                                  Kaldır
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {canUpdate ? (
                  <div className="border-t border-line px-4 py-3">
                    <SubmitButton>Varyant tablosunu kaydet</SubmitButton>
                  </div>
                ) : null}
              </>
            );
          }}
        </ActionForm>
      )}

      {canUpdate && rows.length > 0 ? (
        <DeleteVariantForms ids={rows.map((v) => v.id)} />
      ) : null}
    </section>
  );
}

/**
 * Silme formlari tablonun disinda durur.
 * Satirdaki buton form="..." ile bunlara baglanir; HTML'de form ic ice
 * konulamaz, boylece varyant tablosunun formu bozulmaz.
 */
function DeleteVariantForms({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <ActionForm key={id} action={deleteVariantAction} id={`variant-delete-${id}`}>
          {() => <input type="hidden" name="variantId" value={id} />}
        </ActionForm>
      ))}
    </>
  );
}
