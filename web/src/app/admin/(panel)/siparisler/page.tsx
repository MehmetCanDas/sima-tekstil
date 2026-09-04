import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { companyOptions } from "@/lib/admin/customers";
import { PAGE_SIZE, listOrders } from "@/lib/admin/sales";
import { ORDER_STATUS, dateTime, money } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { SortLink, TableToolbar } from "@/components/admin/TableToolbar";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Siparişler" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("order.read");
  const params = await searchParams;

  const { rows, total, page } = listOrders({
    q: params.q,
    status: params.status,
    company: params.company,
    sort: params.sort,
    dir: params.dir,
    page: pageFrom(params.page),
  });

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="mb-4">
        <h1 className="text-[26px] font-bold uppercase">Siparişler</h1>
        <p className="text-[13px] text-muted">
          {total.toLocaleString("tr")} sipariş · onaylanan teklifler buraya düşer
        </p>
      </div>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Sipariş no, kişi, e-posta, kargo takip ara…"
          filters={[
            {
              name: "status",
              label: "Durum",
              options: Object.entries(ORDER_STATUS).map(([value, s]) => ({
                value,
                label: s.label,
              })),
            },
            {
              name: "company",
              label: "Firma",
              options: companyOptions().map((c) => ({ value: c.id, label: c.name })),
            },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            title="Sipariş yok"
            body="Siparişler bir teklifin siparişe çevrilmesiyle oluşur. Teklifler ekranından bir teklif açıp fiyatları girin."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[900px]">
              <thead>
                <tr>
                  <th>
                    <SortLink column="code" label="Sipariş" />
                  </th>
                  <th>Müşteri</th>
                  <th>Kargo</th>
                  <th className="text-right">Kalem</th>
                  <th className="text-right">
                    <SortLink column="total" label="Tutar" />
                  </th>
                  <th>
                    <SortLink column="status" label="Durum" />
                  </th>
                  <th className="text-right">
                    <SortLink column="created" label="Tarih" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        href={`/admin/siparisler/${o.id}`}
                        className="font-mono font-semibold hover:text-accent"
                      >
                        {o.code}
                      </Link>
                    </td>
                    <td>
                      <span className="font-semibold">
                        {o.companyName ?? o.contactName ?? "—"}
                      </span>
                      <div className="text-[12px] text-muted">
                        {o.email ?? "—"}
                        {o.city ? ` · ${o.city}` : ""}
                      </div>
                    </td>
                    <td className="text-[12px]">
                      {o.trackingNumber ? (
                        <span className="font-mono">{o.trackingNumber}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{o.itemCount}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {money(o.totalMinor, o.currency)}
                    </td>
                    <td>
                      <StatusBadge map={ORDER_STATUS} value={o.status} />
                    </td>
                    <td className="whitespace-nowrap text-right text-[12px] text-muted">
                      {dateTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={params}
          basePath="/admin/siparisler"
        />
      </div>
    </div>
  );
}
