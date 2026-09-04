import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { getOrderDetail } from "@/lib/admin/sales";
import { archiveOrderAction } from "@/lib/admin/sales.actions";
import { ORDER_STATUS, dateTime, money } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { ArchiveAccountButton } from "../../musteriler/[id]/ArchiveAccountButton";
import { OrderForm } from "./OrderForm";

export const metadata: Metadata = { title: "Sipariş" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("order.read");
  const me = (await getCurrentUser())!;
  const { id } = await params;

  const detail = getOrderDetail(id);
  if (!detail) notFound();
  const { order, items } = detail;

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/siparisler" className="text-[13px] text-muted hover:text-ink">
        ← Siparişler
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-[26px] font-bold uppercase">{order.code}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <StatusBadge map={ORDER_STATUS} value={order.status} />
            <span>{dateTime(order.createdAt)}</span>
            {order.quoteId ? (
              <Link
                href={`/admin/teklifler/${order.quoteId}`}
                className="text-accent hover:underline"
              >
                kaynak teklif →
              </Link>
            ) : null}
          </div>
        </div>
        {me.permissions.has("order.delete") ? (
          <ArchiveAccountButton action={archiveOrderAction} id={order.id} archived={false} />
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="a-card overflow-x-auto">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              Sipariş kalemleri ({items.length})
            </h2>
            <p className="text-[12px] text-muted">
              Fiyatlar sipariş anında dondurulur; ürün sonradan değişse de bu kayıt sabit kalır.
            </p>
          </header>
          <table className="a-table min-w-[560px]">
            <thead>
              <tr>
                <th>Ürün</th>
                <th className="text-right">Adet</th>
                <th className="text-right">Birim</th>
                <th className="text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
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
                      {[item.sku, item.colorName, item.sizeName].filter(Boolean).join(" · ") ||
                        "—"}
                      {item.variantId && item.variantStock !== null
                        ? ` · stok ${item.variantStock}`
                        : ""}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{item.qty.toLocaleString("tr")}</td>
                  <td className="text-right tabular-nums">
                    {money(item.unitPriceMinor, order.currency)}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {money(item.totalMinor, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right text-[13px] text-muted">
                  Ara toplam
                </td>
                <td className="text-right tabular-nums">
                  {money(order.subtotalMinor, order.currency)}
                </td>
              </tr>
              {order.discountMinor > 0 ? (
                <tr>
                  <td colSpan={3} className="text-right text-[13px] text-muted">
                    İskonto
                  </td>
                  <td className="text-right tabular-nums">
                    −{money(order.discountMinor, order.currency)}
                  </td>
                </tr>
              ) : null}
              {order.shippingMinor > 0 ? (
                <tr>
                  <td colSpan={3} className="text-right text-[13px] text-muted">
                    Kargo
                  </td>
                  <td className="text-right tabular-nums">
                    {money(order.shippingMinor, order.currency)}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} className="text-right font-semibold">
                  Genel toplam
                </td>
                <td className="text-right font-display text-[18px] font-bold tabular-nums">
                  {money(order.totalMinor, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="a-card">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              Müşteri
            </h2>
          </header>
          <dl className="grid gap-px bg-line">
            <Info label="Firma">
              {order.companyId ? (
                <Link
                  href={`/admin/firmalar/${order.companyId}`}
                  className="font-semibold hover:text-accent"
                >
                  {order.companyName}
                </Link>
              ) : (
                "—"
              )}
            </Info>
            <Info label="Yetkili">
              {order.userId ? (
                <Link
                  href={`/admin/musteriler/${order.userId}`}
                  className="font-semibold hover:text-accent"
                >
                  {order.contactName ?? "—"}
                </Link>
              ) : (
                (order.contactName ?? "—")
              )}
            </Info>
            <Info label="E-posta">{order.email ?? "—"}</Info>
            <Info label="Telefon">{order.phone ?? "—"}</Info>
            <Info label="Şehir / ülke">
              {[order.city, order.country].filter(Boolean).join(" / ") || "—"}
            </Info>
            <Info label="Teslimat adresi">{order.shippingAddress ?? "—"}</Info>
          </dl>
        </section>
      </div>

      <div className="mt-5">
        <OrderForm
          order={{
            id: order.id,
            status: order.status,
            note: order.note,
            adminNote: order.adminNote,
            trackingNumber: order.trackingNumber,
            carrier: order.carrier,
            shippingAddress: order.shippingAddress,
          }}
          canUpdate={me.permissions.has("order.update")}
        />
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg px-4 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
        {label}
      </dt>
      <dd className="text-[13.5px]">{children}</dd>
    </div>
  );
}
