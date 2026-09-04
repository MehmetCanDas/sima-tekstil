"use client";

import { updateOrderAction } from "@/lib/admin/sales.actions";
import { ORDER_STATUS } from "@/lib/admin/format";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Siparis yonetimi (spec: 14).
 *
 * Kalemler ve fiyatlar siparis olustugunda dondurulur; buradan yalnizca surec
 * alanlari degisir. Bir siparisin icerigini degistirmek gerekiyorsa iptal edip
 * yeni teklif acmak dogru yoldur.
 * ------------------------------------------------------------------------ */

export function OrderForm({
  order,
  canUpdate,
}: {
  order: {
    id: string;
    status: string;
    note: string | null;
    adminNote: string | null;
    trackingNumber: string | null;
    carrier: string | null;
    shippingAddress: string | null;
  };
  canUpdate: boolean;
}) {
  return (
    <ActionForm action={updateOrderAction} className="a-card p-5">
      {(state) => (
        <>
          <input type="hidden" name="id" value={order.id} />

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Sipariş durumu" name="status">
              {(p) => (
                <select
                  {...p}
                  className="a-select"
                  defaultValue={order.status}
                  disabled={!canUpdate}
                >
                  {Object.entries(ORDER_STATUS).map(([value, s]) => (
                    <option key={value} value={value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Kargo firması" name="carrier">
              {(p) => (
                <input
                  {...p}
                  className="a-input"
                  defaultValue={order.carrier ?? ""}
                  disabled={!canUpdate}
                />
              )}
            </Field>
            <Field label="Takip numarası" name="trackingNumber">
              {(p) => (
                <input
                  {...p}
                  className="a-input font-mono"
                  defaultValue={order.trackingNumber ?? ""}
                  disabled={!canUpdate}
                />
              )}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Teslimat adresi" name="shippingAddress">
              {(p) => (
                <textarea
                  {...p}
                  className="a-textarea"
                  rows={2}
                  defaultValue={order.shippingAddress ?? ""}
                  disabled={!canUpdate}
                />
              )}
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Müşteriye görünen not"
              name="note"
              hint="Sipariş yazışmasında müşteriye iletilecek metin."
            >
              {(p) => (
                <textarea
                  {...p}
                  className="a-textarea"
                  rows={4}
                  defaultValue={order.note ?? ""}
                  disabled={!canUpdate}
                />
              )}
            </Field>
            <Field
              label="Dahili not"
              name="adminNote"
              hint="Yalnızca panelde görünür."
            >
              {(p) => (
                <textarea
                  {...p}
                  className="a-textarea"
                  rows={4}
                  defaultValue={order.adminNote ?? ""}
                  disabled={!canUpdate}
                />
              )}
            </Field>
          </div>

          {canUpdate ? (
            <div className="mt-5 flex items-center gap-3">
              <SubmitButton>Siparişi kaydet</SubmitButton>
              {state && !state.ok ? (
                <span className="text-[13px] text-[#b3261e]">{state.error}</span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}
