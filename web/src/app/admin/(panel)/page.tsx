import Link from "next/link";
import { and, count, desc, eq, inArray, isNull, lt, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products, quotes, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_STATUS, QUOTE_STATUS, dateTime, money } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { getSetting } from "@/lib/admin/settings";

/* ---------------------------------------------------------------------------
 * Panel ana ekrani.
 *
 * Her KPI tek bir indeksli COUNT/SUM sorgusudur; tablo buyudugunde de sabit
 * maliyetle calisir. Gorulmeyen bolumler icin sorgu hic calistirilmaz.
 * ------------------------------------------------------------------------ */

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const can = (p: string) => user.permissions.has(p as never);
  const lowStock = Number(await getSetting("low_stock_threshold", 20));

  const productStats = can("product.read")
    ? {
        total: db
          .select({ n: count() })
          .from(products)
          .where(isNull(products.deletedAt))
          .get()!.n,
        active: db
          .select({ n: count() })
          .from(products)
          .where(and(eq(products.status, "active"), isNull(products.deletedAt)))
          .get()!.n,
        draft: db
          .select({ n: count() })
          .from(products)
          .where(and(eq(products.status, "draft"), isNull(products.deletedAt)))
          .get()!.n,
        low: db
          .select({ n: count() })
          .from(products)
          .where(and(lt(products.stock, lowStock), isNull(products.deletedAt)))
          .get()!.n,
      }
    : null;

  const customerStats = can("customer.read")
    ? {
        total: db
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.role, "customer"), isNull(users.deletedAt)))
          .get()!.n,
        pending: db
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.status, "pending"), isNull(users.deletedAt)))
          .get()!.n,
      }
    : null;

  const orderStats = can("order.read")
    ? {
        pending: db
          .select({ n: count() })
          .from(orders)
          .where(and(eq(orders.status, "pending"), isNull(orders.deletedAt)))
          .get()!.n,
        revenue:
          db
            .select({ total: sum(orders.totalMinor) })
            .from(orders)
            .where(
              and(
                inArray(orders.status, ["confirmed", "processing", "ready_to_ship", "shipped", "delivered"]),
                isNull(orders.deletedAt),
              ),
            )
            .get()?.total ?? 0,
      }
    : null;

  const quoteStats = can("quote.read")
    ? db
        .select({ n: count() })
        .from(quotes)
        .where(and(inArray(quotes.status, ["new", "in_review"]), isNull(quotes.deletedAt)))
        .get()!.n
    : null;

  const recentOrders = can("order.read")
    ? db
        .select({
          id: orders.id,
          code: orders.code,
          status: orders.status,
          totalMinor: orders.totalMinor,
          currency: orders.currency,
          contactName: orders.contactName,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.createdAt))
        .limit(8)
        .all()
    : [];

  const recentQuotes = can("quote.read")
    ? db
        .select({
          id: quotes.id,
          code: quotes.code,
          status: quotes.status,
          companyName: quotes.companyName,
          contactName: quotes.contactName,
          createdAt: quotes.createdAt,
        })
        .from(quotes)
        .where(isNull(quotes.deletedAt))
        .orderBy(desc(quotes.createdAt))
        .limit(8)
        .all()
    : [];

  const topProducts = can("report.read")
    ? db
        .select({
          name: orderItems.name,
          productId: orderItems.productId,
          qty: sql<number>`SUM(${orderItems.qty})`.as("qty"),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(isNull(orders.deletedAt), sql`${orders.status} <> 'cancelled'`))
        .groupBy(orderItems.name, orderItems.productId)
        .orderBy(desc(sql`qty`))
        .limit(6)
        .all()
    : [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[28px] font-bold uppercase">
        Merhaba {user.name}
      </h1>
      <p className="mt-1 text-[14px] text-ink-2">
        Bugünün özeti. Aşağıdaki her kart ilgili listeye götürür.
      </p>

      <div className="mt-6 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {productStats ? (
          <>
            <Kpi
              href="/admin/urunler"
              value={productStats.total}
              label="toplam ürün"
            />
            <Kpi
              href="/admin/urunler?status=active"
              value={productStats.active}
              label="yayında"
              tone={productStats.active === 0 ? "warn" : "ok"}
            />
            <Kpi
              href="/admin/urunler?status=draft"
              value={productStats.draft}
              label="taslak"
            />
            <Kpi
              href={`/admin/urunler?stock=low`}
              value={productStats.low}
              label={`stok < ${lowStock}`}
              tone={productStats.low > 0 ? "warn" : undefined}
            />
          </>
        ) : null}
      </div>

      <div className="mt-5 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {customerStats ? (
          <>
            <Kpi href="/admin/musteriler" value={customerStats.total} label="müşteri hesabı" />
            <Kpi
              href="/admin/musteriler?status=pending"
              value={customerStats.pending}
              label="onay bekleyen başvuru"
              tone={customerStats.pending > 0 ? "warn" : undefined}
            />
          </>
        ) : null}
        {quoteStats !== null ? (
          <Kpi
            href="/admin/teklifler"
            value={quoteStats}
            label="açık teklif"
            tone={quoteStats > 0 ? "warn" : undefined}
          />
        ) : null}
        {orderStats ? (
          <Kpi
            href="/admin/siparisler?status=pending"
            value={orderStats.pending}
            label="bekleyen sipariş"
            tone={orderStats.pending > 0 ? "warn" : undefined}
          />
        ) : null}
      </div>

      {orderStats ? (
        <div className="a-card mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 p-5">
          <span className="u-eyebrow">Toplam satış</span>
          <span className="font-display text-[34px] font-bold tabular-nums">
            {money(Number(orderStats.revenue))}
          </span>
          <span className="text-[13px] text-muted">
            iptal edilmemiş, onaylanmış siparişlerin toplamı
          </span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {can("order.read") ? (
          <Panel title="Son siparişler" href="/admin/siparisler">
            {recentOrders.length === 0 ? (
              <Placeholder text="Henüz sipariş yok." />
            ) : (
              <table className="a-table">
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={`/admin/siparisler/${o.id}`}
                          className="font-semibold hover:text-accent"
                        >
                          {o.code}
                        </Link>
                        <div className="text-[12px] text-muted">{o.contactName ?? "—"}</div>
                      </td>
                      <td>
                        <StatusBadge map={ORDER_STATUS} value={o.status} />
                      </td>
                      <td className="text-right tabular-nums">
                        {money(o.totalMinor, o.currency)}
                      </td>
                      <td className="whitespace-nowrap text-right text-[12px] text-muted">
                        {dateTime(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ) : null}

        {can("quote.read") ? (
          <Panel title="Son teklif talepleri" href="/admin/teklifler">
            {recentQuotes.length === 0 ? (
              <Placeholder text="Henüz teklif talebi yok." />
            ) : (
              <table className="a-table">
                <tbody>
                  {recentQuotes.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Link
                          href={`/admin/teklifler/${q.id}`}
                          className="font-semibold hover:text-accent"
                        >
                          {q.code}
                        </Link>
                        <div className="text-[12px] text-muted">
                          {q.companyName ?? q.contactName ?? "—"}
                        </div>
                      </td>
                      <td>
                        <StatusBadge map={QUOTE_STATUS} value={q.status} />
                      </td>
                      <td className="whitespace-nowrap text-right text-[12px] text-muted">
                        {dateTime(q.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        ) : null}
      </div>

      {can("report.read") ? (
        <div className="mt-5">
          <Panel title="En çok sipariş edilen ürünler">
            {topProducts.length === 0 ? (
              <Placeholder text="Sipariş verisi biriktikçe burası dolacak." />
            ) : (
              <table className="a-table">
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={`${p.productId}-${p.name}`}>
                      <td>
                        {p.productId ? (
                          <Link
                            href={`/admin/urunler/${p.productId}`}
                            className="font-semibold hover:text-accent"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {Number(p.qty).toLocaleString("tr")} adet
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  href,
  value,
  label,
  tone,
}: {
  href: string;
  value: number;
  label: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Link href={href} className="group bg-bg p-4 hover:bg-surface">
      <div
        className={`font-display text-[30px] font-bold tabular-nums ${
          tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : ""
        }`}
      >
        {value.toLocaleString("tr")}
      </div>
      <div className="text-[13px] leading-tight text-muted group-hover:text-ink-2">
        {label}
      </div>
    </Link>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="a-card">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[16px] font-semibold uppercase">{title}</h2>
        {href ? (
          <Link href={href} className="text-[12px] font-semibold text-accent hover:underline">
            Tümü →
          </Link>
        ) : null}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted">{text}</p>;
}
