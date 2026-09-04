"use client";

import Link from "next/link";
import { useState } from "react";

import { convertQuoteAction, updateQuoteAction } from "@/lib/admin/sales.actions";
import { QUOTE_STATUS, money, moneyInput } from "@/lib/admin/format";
import { ActionForm, ConfirmSubmit, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Teklif duzenleme (spec: 15).
 *
 * Kalem fiyatlari ve teklif durumu tek formda kaydedilir. Toplam istemcide
 * yalnizca onizleme icin hesaplanir; kaydedilen deger her zaman sunucuda
 * kalemlerden yeniden uretilir.
 * ------------------------------------------------------------------------ */

type Item = {
  id: string;
  productId: string | null;
  name: string;
  sku: string | null;
  colorName: string | null;
  sizeName: string | null;
  qty: number;
  quotedPriceMinor: number | null;
  listPriceMinor: number | null;
  wholesaleMinor: number | null;
};

export function QuoteEditor({
  quote,
  items,
  canUpdate,
  canConvert,
}: {
  quote: {
    id: string;
    code: string;
    status: string;
    currency: string;
    note: string | null;
    adminNote: string | null;
    validUntil: number | null;
    convertedOrderId: string | null;
  };
  items: Item[];
  canUpdate: boolean;
  canConvert: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, { qty: number; price: string }>>(() =>
    Object.fromEntries(
      items.map((i) => [i.id, { qty: i.qty, price: moneyInput(i.quotedPriceMinor) }]),
    ),
  );

  const preview = items.reduce((sum, i) => {
    const d = draft[i.id];
    const price = Number((d?.price ?? "").replace(",", ".")) || 0;
    return sum + (d?.qty ?? i.qty) * Math.round(price * 100);
  }, 0);

  const missingPrices = items.filter((i) => {
    const raw = draft[i.id]?.price ?? "";
    return raw.trim() === "";
  }).length;

  return (
    <ActionForm action={updateQuoteAction} className="flex flex-col gap-5">
      {(state) => (
        <>
          <input type="hidden" name="id" value={quote.id} />

          <section className="a-card overflow-x-auto">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                Talep edilen ürünler ({items.length})
              </h2>
              <span className="text-[13px] text-muted">
                Teklif toplamı{" "}
                <strong className="tabular-nums text-ink">
                  {money(preview, quote.currency)}
                </strong>
              </span>
            </header>

            <table className="a-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th className="text-right">Liste</th>
                  <th className="text-right">Toptan</th>
                  <th className="text-right">Adet</th>
                  <th className="text-right">Teklif fiyatı</th>
                  <th className="text-right">Satır toplamı</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const d = draft[item.id];
                  const price = Number((d?.price ?? "").replace(",", ".")) || 0;
                  const line = (d?.qty ?? item.qty) * Math.round(price * 100);
                  return (
                    <tr key={item.id}>
                      <td>
                        <input type="hidden" name="itemId" value={item.id} />
                        {item.productId ? (
                          <Link
                            href={`/admin/urunler/${item.productId}`}
                            className="font-semibold hover:text-accent"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{item.name}</span>
                        )}
                        <div className="text-[11px] text-muted">
                          {[item.sku, item.colorName, item.sizeName]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="text-right tabular-nums text-muted">
                        {money(item.listPriceMinor, quote.currency)}
                      </td>
                      <td className="text-right tabular-nums text-muted">
                        {money(item.wholesaleMinor, quote.currency)}
                      </td>
                      <td>
                        <input
                          name={`qty_${item.id}`}
                          type="number"
                          min={1}
                          className="a-input w-[92px] text-right tabular-nums"
                          aria-label={`${item.name} adet`}
                          value={d?.qty ?? item.qty}
                          disabled={!canUpdate}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [item.id]: {
                                qty: Math.max(1, Number(e.target.value) || 1),
                                price: prev[item.id]?.price ?? "",
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          name={`price_${item.id}`}
                          inputMode="decimal"
                          className="a-input w-[120px] text-right tabular-nums"
                          placeholder="girilmedi"
                          aria-label={`${item.name} teklif fiyatı`}
                          value={d?.price ?? ""}
                          disabled={!canUpdate}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [item.id]: {
                                qty: prev[item.id]?.qty ?? item.qty,
                                price: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {line > 0 ? money(line, quote.currency) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="a-card p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Teklif durumu" name="status">
                {(p) => (
                  <select
                    {...p}
                    className="a-select"
                    defaultValue={quote.status}
                    disabled={!canUpdate}
                  >
                    {Object.entries(QUOTE_STATUS)
                      // "Siparişe döndü" elle secilemez; donusum isleminde atanir.
                      .filter(([value]) => value !== "converted" || quote.status === "converted")
                      .map(([value, s]) => (
                        <option key={value} value={value}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                )}
              </Field>
              <Field
                label="Geçerlilik tarihi"
                name="validUntil"
                hint="Boş bırakılabilir."
              >
                {(p) => (
                  <input
                    {...p}
                    type="date"
                    className="a-input"
                    defaultValue={
                      quote.validUntil
                        ? new Date(quote.validUntil).toISOString().slice(0, 10)
                        : ""
                    }
                    disabled={!canUpdate}
                  />
                )}
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="Müşteriye görünen not"
                name="note"
                hint="Teklif yazışmasında müşteriye iletilecek metin."
              >
                {(p) => (
                  <textarea
                    {...p}
                    className="a-textarea"
                    rows={4}
                    defaultValue={quote.note ?? ""}
                    disabled={!canUpdate}
                  />
                )}
              </Field>
              <Field
                label="Dahili not"
                name="adminNote"
                hint="Yalnızca panelde görünür, müşteriye gösterilmez."
              >
                {(p) => (
                  <textarea
                    {...p}
                    className="a-textarea"
                    rows={4}
                    defaultValue={quote.adminNote ?? ""}
                    disabled={!canUpdate}
                  />
                )}
              </Field>
            </div>

            {canUpdate ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SubmitButton>Teklifi kaydet</SubmitButton>
                {state && !state.ok ? (
                  <span className="text-[13px] text-[#b3261e]">{state.error}</span>
                ) : null}
              </div>
            ) : null}
          </section>

          {canConvert && !quote.convertedOrderId ? (
            <ConvertPanel quoteId={quote.id} missingPrices={missingPrices} />
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

/**
 * Siparise cevirme kendi formundadir: teklif formunun icine gomulmesi tek
 * gonderimde iki farkli islem anlamina gelirdi.
 */
function ConvertPanel({
  quoteId,
  missingPrices,
}: {
  quoteId: string;
  missingPrices: number;
}) {
  return (
    <section className="a-card border-l-4 border-l-accent p-5">
      <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        Siparişe çevir
      </h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
        Teklif kalemleri ve girilen fiyatlar yeni bir siparişe kopyalanır. Teklif
        &ldquo;Siparişe döndü&rdquo; olarak işaretlenir ve fiyatlar sipariş kaydında
        dondurulur.
      </p>
      {missingPrices > 0 ? (
        <p className="mt-3 border border-[#e0b4b1] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#b3261e]">
          {missingPrices} kalemin fiyatı girilmedi. Önce fiyatları girip teklifi
          kaydedin.
        </p>
      ) : null}
    </section>
  );
}

/** Teklif formunun disinda duran donusum formu. */
export function ConvertQuoteForm({ quoteId }: { quoteId: string }) {
  return (
    <ActionForm action={convertQuoteAction}>
      {() => (
        <>
          <input type="hidden" name="id" value={quoteId} />
          <ConfirmSubmit
            className="a-btn a-btn-primary"
            title="Teklif siparişe çevrilsin mi?"
            body="Kalemler ve fiyatlar yeni bir sipariş kaydına kopyalanır. Bu işlem geri alınamaz; sipariş sonradan iptal edilebilir."
            confirmLabel="Siparişe çevir"
          >
            Siparişe çevir
          </ConfirmSubmit>
        </>
      )}
    </ActionForm>
  );
}
