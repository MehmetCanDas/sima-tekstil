import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { PAGE_SIZE, companyCities, listCompanies } from "@/lib/admin/customers";
import { ACCOUNT_STATUS, dateOnly } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { SortLink, TableToolbar } from "@/components/admin/TableToolbar";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Firmalar" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("customer.read");
  const me = (await getCurrentUser())!;
  const params = await searchParams;

  const { rows, total, page } = listCompanies({
    q: params.q,
    status: params.status,
    city: params.city,
    sort: params.sort,
    dir: params.dir,
    page: pageFrom(params.page),
  });
  const cities = companyCities();

  return (
    <div className="mx-auto max-w-[1300px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">Firmalar</h1>
          <p className="text-[13px] text-muted">
            {total.toLocaleString("tr")} firma · bir firmada birden fazla kullanıcı olabilir
          </p>
        </div>
        {me.permissions.has("customer.create") ? (
          <Link href="/admin/firmalar/yeni" className="a-btn a-btn-primary">
            Yeni firma
          </Link>
        ) : null}
      </div>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Firma adı, vergi no, e-posta ara…"
          filters={[
            {
              name: "status",
              label: "Durum",
              options: [
                { value: "pending", label: "Onay bekliyor" },
                { value: "active", label: "Aktif" },
                { value: "suspended", label: "Askıda" },
                { value: "archived", label: "Arşiv" },
              ],
            },
            {
              name: "city",
              label: "Şehir",
              options: cities.map((c) => ({ value: c, label: c })),
            },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            title="Firma bulunamadı"
            body="Filtreleri değiştirin veya yeni bir firma kaydı açın."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[900px]">
              <thead>
                <tr>
                  <th>
                    <SortLink column="name" label="Firma" />
                  </th>
                  <th>Vergi no</th>
                  <th>
                    <SortLink column="city" label="Şehir" />
                  </th>
                  <th>İletişim</th>
                  <th className="text-right">Kullanıcı</th>
                  <th className="text-right">Sipariş</th>
                  <th className="text-right">İskonto</th>
                  <th>
                    <SortLink column="status" label="Durum" />
                  </th>
                  <th className="text-right">
                    <SortLink column="created" label="Kayıt" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/admin/firmalar/${c.id}`}
                        className="font-semibold hover:text-accent"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="font-mono text-[12px]">{c.taxNumber ?? "—"}</td>
                    <td className="text-[12px]">
                      {c.city ?? "—"}
                      <div className="text-[11px] text-muted">{c.country}</div>
                    </td>
                    <td className="text-[12px]">
                      {c.email ?? "—"}
                      {c.phone ? (
                        <div className="text-[11px] text-muted">{c.phone}</div>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{c.userCount}</td>
                    <td className="text-right tabular-nums">{c.orderCount}</td>
                    <td className="text-right tabular-nums">
                      {c.discountBp > 0 ? `%${(c.discountBp / 100).toLocaleString("tr")}` : "—"}
                    </td>
                    <td>
                      <StatusBadge map={ACCOUNT_STATUS} value={c.status} />
                    </td>
                    <td className="whitespace-nowrap text-right text-[12px] text-muted">
                      {dateOnly(c.createdAt)}
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
          basePath="/admin/firmalar"
        />
      </div>
    </div>
  );
}
