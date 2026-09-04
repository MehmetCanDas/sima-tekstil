import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { companyOptions } from "@/lib/admin/customers";
import { PAGE_SIZE, listQuotes } from "@/lib/admin/sales";
import { QUOTE_STATUS, dateTime, money } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { SortLink, TableToolbar } from "@/components/admin/TableToolbar";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Teklifler" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("quote.read");
  const params = await searchParams;

  const { rows, total, page } = listQuotes({
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
        <h1 className="text-[26px] font-bold uppercase">Teklifler</h1>
        <p className="text-[13px] text-muted">
          {total.toLocaleString("tr")} talep · siteden gelen teklif istekleri
        </p>
      </div>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Teklif no, firma, kişi, e-posta ara…"
          filters={[
            {
              name: "status",
              label: "Durum",
              options: Object.entries(QUOTE_STATUS).map(([value, s]) => ({
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
            title="Teklif talebi yok"
            body="Siteden bir teklif talebi geldiğinde burada listelenir. Talep formu /teklif sayfasındadır."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[960px]">
              <thead>
                <tr>
                  <th>
                    <SortLink column="code" label="Teklif" />
                  </th>
                  <th>Firma / kişi</th>
                  <th>İletişim</th>
                  <th className="text-right">Kalem</th>
                  <th className="text-right">Adet</th>
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
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link
                        href={`/admin/teklifler/${q.id}`}
                        className="font-mono font-semibold hover:text-accent"
                      >
                        {q.code}
                      </Link>
                    </td>
                    <td>
                      <span className="font-semibold">
                        {q.registeredCompany ?? q.companyName ?? "—"}
                      </span>
                      <div className="text-[12px] text-muted">
                        {q.contactName ?? "—"}
                        {q.city ? ` · ${q.city}` : ""}
                      </div>
                    </td>
                    <td className="text-[12px]">
                      {q.email ?? "—"}
                      {q.phone ? <div className="text-[11px] text-muted">{q.phone}</div> : null}
                    </td>
                    <td className="text-right tabular-nums">{q.itemCount}</td>
                    <td className="text-right tabular-nums">
                      {Number(q.totalQty).toLocaleString("tr")}
                    </td>
                    <td className="text-right tabular-nums">
                      {q.totalMinor > 0 ? money(q.totalMinor, q.currency) : "—"}
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
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={params}
          basePath="/admin/teklifler"
        />
      </div>
    </div>
  );
}
