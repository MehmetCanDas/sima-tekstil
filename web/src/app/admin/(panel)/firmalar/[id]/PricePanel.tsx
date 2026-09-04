"use client";

import Link from "next/link";

import {
  deleteCustomerPriceAction,
  saveCustomerPriceAction,
} from "@/lib/admin/customers.actions";
import { money } from "@/lib/admin/format";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Musteriye ozel fiyatlar (spec: 13).
 *
 * Cozunurluk sirasi: bu tablodaki urun fiyati > firmanin genel iskontosu >
 * urunun toptan fiyati. Urun, acilir listeyle degil kod/slug yazilarak secilir;
 * 100.000 urunlu bir katalogda acilir liste kullanilamaz.
 * ------------------------------------------------------------------------ */

type PriceRow = {
  id: string;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  priceMinor: number;
  currency: string;
  minQty: number;
  listPriceMinor: number | null;
  wholesaleMinor: number | null;
};

export function PricePanel({
  companyId,
  companyName,
  discountBp,
  prices,
  canEdit,
}: {
  companyId: string;
  companyName: string;
  discountBp: number;
  prices: PriceRow[];
  canEdit: boolean;
}) {
  return (
    <section className="a-card">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
          {companyName} için özel fiyatlar
        </h2>
        <p className="text-[12px] text-muted">
          {discountBp > 0
            ? `Buradaki ürünler dışında %${(discountBp / 100).toLocaleString("tr")} genel iskonto uygulanır.`
            : "Firma için genel iskonto tanımlı değil."}
        </p>
      </header>

      {canEdit ? (
        <div className="border-b border-line p-4">
          <ActionForm
            action={saveCustomerPriceAction}
            resetOnSuccess
            className="grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
          >
            {(state) => {
              const err = (f: string) =>
                state && !state.ok ? state.fieldErrors?.[f] : undefined;
              return (
                <>
                  <input type="hidden" name="companyId" value={companyId} />
                  <Field
                    label="Ürün"
                    name="productId"
                    required
                    error={err("productId")}
                    hint="Ürün kodu (SKU) veya slug yazın."
                  >
                    {(p) => (
                      <input {...p} className="a-input" placeholder="TS001 veya polar-mont-s2" required />
                    )}
                  </Field>
                  <Field label="Özel fiyat" name="price" required error={err("price")}>
                    {(p) => (
                      <input
                        {...p}
                        className="a-input"
                        inputMode="decimal"
                        placeholder="89,90"
                        required
                      />
                    )}
                  </Field>
                  <Field label="Min. adet" name="minQty" error={err("minQty")}>
                    {(p) => (
                      <input {...p} className="a-input" type="number" min={1} defaultValue={1} />
                    )}
                  </Field>
                  <SubmitButton>Ekle</SubmitButton>
                </>
              );
            }}
          </ActionForm>
        </div>
      ) : null}

      {prices.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted">
          Bu firmaya özel fiyat tanımlanmadı.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="a-table min-w-[680px]">
            <thead>
              <tr>
                <th>Ürün</th>
                <th className="text-right">Liste</th>
                <th className="text-right">Toptan</th>
                <th className="text-right">Bu firmaya</th>
                <th className="text-right">Min. adet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prices.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.productId ? (
                      <Link
                        href={`/admin/urunler/${row.productId}`}
                        className="font-semibold hover:text-accent"
                      >
                        {row.productName}
                      </Link>
                    ) : (
                      <span className="text-muted">silinmiş ürün</span>
                    )}
                    {row.productSku ? (
                      <div className="font-mono text-[11px] text-muted">{row.productSku}</div>
                    ) : null}
                  </td>
                  <td className="text-right tabular-nums text-muted">
                    {money(row.listPriceMinor, row.currency)}
                  </td>
                  <td className="text-right tabular-nums text-muted">
                    {money(row.wholesaleMinor, row.currency)}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {money(row.priceMinor, row.currency)}
                  </td>
                  <td className="text-right tabular-nums">{row.minQty}</td>
                  <td className="text-right">
                    {canEdit ? (
                      <ActionForm action={deleteCustomerPriceAction}>
                        {() => (
                          <>
                            <input type="hidden" name="priceId" value={row.id} />
                            <SubmitButton
                              className="a-btn a-btn-danger a-btn-sm"
                              pendingText="…"
                            >
                              Kaldır
                            </SubmitButton>
                          </>
                        )}
                      </ActionForm>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
