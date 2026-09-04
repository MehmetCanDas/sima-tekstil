import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { ROLE_LABEL, ROLES } from "@/lib/auth/rbac";
import { PAGE_SIZE, companyCities, companyOptions, listUsers } from "@/lib/admin/customers";
import { ACCOUNT_STATUS, dateOnly, relative } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { SortLink, TableToolbar } from "@/components/admin/TableToolbar";
import { EmptyState } from "@/components/admin/ui";
import { StatusActions } from "./StatusActions";

export const metadata: Metadata = { title: "Kullanıcılar" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("customer.read");
  const me = (await getCurrentUser())!;
  const params = await searchParams;

  const { rows, total, page } = listUsers({
    q: params.q,
    status: params.status,
    role: params.role,
    company: params.company,
    city: params.city,
    sort: params.sort,
    dir: params.dir,
    page: pageFrom(params.page),
  });

  const companies = companyOptions();
  const cities = companyCities();
  const canApprove = me.permissions.has("customer.approve");
  const canSuspend = me.permissions.has("customer.suspend");

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">Kullanıcılar</h1>
          <p className="text-[13px] text-muted">
            {total.toLocaleString("tr")} hesap · siteye kayıt olan herkes burada
          </p>
        </div>
        {me.permissions.has("customer.create") ? (
          <Link href="/admin/musteriler/yeni" className="a-btn a-btn-primary">
            Yeni hesap
          </Link>
        ) : null}
      </div>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Ad, e-posta, telefon veya firma ara…"
          filters={[
            {
              name: "status",
              label: "Durum",
              options: Object.entries(ACCOUNT_STATUS).map(([value, s]) => ({
                value,
                label: s.label,
              })),
            },
            {
              name: "role",
              label: "Rol",
              options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
            },
            {
              name: "company",
              label: "Firma",
              options: companies.map((c) => ({ value: c.id, label: c.name })),
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
            title="Kayıt bulunamadı"
            body="Filtreleri değiştirin. Siteye henüz kimse kayıt olmadıysa bu liste boş kalır."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[960px]">
              <thead>
                <tr>
                  <th>
                    <SortLink column="name" label="Kişi" />
                  </th>
                  <th>
                    <SortLink column="email" label="E-posta" />
                  </th>
                  <th>Firma</th>
                  <th>Rol</th>
                  <th>
                    <SortLink column="status" label="Durum" />
                  </th>
                  <th className="text-right">
                    <SortLink column="created" label="Kayıt" />
                  </th>
                  <th className="text-right">
                    <SortLink column="login" label="Son giriş" />
                  </th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link
                        href={`/admin/musteriler/${u.id}`}
                        className="font-semibold hover:text-accent"
                      >
                        {`${u.name} ${u.surname}`.trim()}
                      </Link>
                      {u.phone ? (
                        <div className="text-[12px] text-muted">{u.phone}</div>
                      ) : null}
                    </td>
                    <td className="text-[12px]">{u.email}</td>
                    <td className="text-[12px]">
                      {u.companyId ? (
                        <Link
                          href={`/admin/firmalar/${u.companyId}`}
                          className="hover:text-accent"
                        >
                          {u.companyName}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {u.companyCity ? (
                        <div className="text-[11px] text-muted">{u.companyCity}</div>
                      ) : null}
                    </td>
                    <td className="text-[12px]">
                      {ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] ?? u.role}
                    </td>
                    <td>
                      <StatusBadge map={ACCOUNT_STATUS} value={u.status} />
                    </td>
                    <td className="whitespace-nowrap text-right text-[12px] text-muted">
                      {dateOnly(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap text-right text-[12px] text-muted">
                      {relative(u.lastLoginAt)}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <StatusActions
                          userId={u.id}
                          status={u.status}
                          canApprove={canApprove}
                          canSuspend={canSuspend}
                          compact
                        />
                      </div>
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
          basePath="/admin/musteriler"
        />
      </div>
    </div>
  );
}
