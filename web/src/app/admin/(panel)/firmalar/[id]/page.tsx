import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { getCompanyDetail } from "@/lib/admin/customers";
import { archiveCompanyAction } from "@/lib/admin/customers.actions";
import {
  ACCOUNT_STATUS,
  ORDER_STATUS,
  QUOTE_STATUS,
  dateTime,
  money,
  relative,
} from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { NotesPanel } from "@/components/admin/NotesPanel";
import { ArchiveAccountButton } from "../../musteriler/[id]/ArchiveAccountButton";
import { CompanyForm } from "../CompanyForm";
import { PricePanel } from "./PricePanel";

export const metadata: Metadata = { title: "Firma" };

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("customer.read");
  const me = (await getCurrentUser())!;
  const { id } = await params;
  const { tab: rawTab } = await searchParams;

  const detail = getCompanyDetail(id);
  if (!detail) notFound();
  const { company } = detail;

  const tabs = [
    { id: "ozet", label: `Kullanıcılar (${detail.members.length})` },
    { id: "fiyatlar", label: `Özel fiyatlar (${detail.prices.length})` },
    { id: "siparisler", label: `Siparişler (${detail.orders.length})` },
    { id: "teklifler", label: `Teklifler (${detail.quotes.length})` },
    ...(me.permissions.has("customer.update") ? [{ id: "duzenle", label: "Düzenle" }] : []),
  ];
  const tab = tabs.some((t) => t.id === rawTab) ? rawTab! : "ozet";

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/firmalar" className="text-[13px] text-muted hover:text-ink">
        ← Firmalar
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <StatusBadge map={ACCOUNT_STATUS} value={company.status} />
            {company.taxNumber ? <span>VN {company.taxNumber}</span> : null}
            <span>{[company.city, company.country].filter(Boolean).join(", ")}</span>
            {company.discountBp > 0 ? (
              <span className="text-accent">
                %{(company.discountBp / 100).toLocaleString("tr")} iskonto
              </span>
            ) : null}
          </div>
        </div>
        {me.permissions.has("customer.delete") ? (
          <ArchiveAccountButton
            action={archiveCompanyAction}
            id={company.id}
            archived={company.deletedAt !== null}
          />
        ) : null}
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/firmalar/${id}?tab=${t.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-[13.5px] font-semibold ${
              tab === t.id
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "ozet" ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="a-card">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                Firma kullanıcıları
              </h2>
              {me.permissions.has("customer.create") ? (
                <Link href="/admin/musteriler/yeni" className="a-btn a-btn-ghost a-btn-sm">
                  Kullanıcı ekle
                </Link>
              ) : null}
            </header>
            {detail.members.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted">
                Bu firmaya bağlı kullanıcı yok.
              </p>
            ) : (
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Kişi</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th className="text-right">Son giriş</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link
                          href={`/admin/musteriler/${m.id}`}
                          className="font-semibold hover:text-accent"
                        >
                          {`${m.name} ${m.surname}`.trim()}
                        </Link>
                        <div className="text-[12px] text-muted">{m.email}</div>
                      </td>
                      <td className="text-[12px]">
                        {ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}
                      </td>
                      <td>
                        <StatusBadge map={ACCOUNT_STATUS} value={m.status} />
                      </td>
                      <td className="whitespace-nowrap text-right text-[12px] text-muted">
                        {relative(m.lastLoginAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <NotesPanel
            notes={detail.notes}
            companyId={company.id}
            canWrite={me.permissions.has("customer.update")}
          />
        </div>
      ) : null}

      {tab === "fiyatlar" ? (
        <PricePanel
          companyId={company.id}
          companyName={company.name}
          discountBp={company.discountBp}
          prices={detail.prices}
          canEdit={me.permissions.has("customer.price")}
        />
      ) : null}

      {tab === "siparisler" ? (
        <section className="a-card overflow-x-auto">
          {detail.orders.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-muted">
              Bu firmanın siparişi yok.
            </p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Durum</th>
                  <th className="text-right">Tutar</th>
                  <th className="text-right">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {detail.orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link
                        href={`/admin/siparisler/${o.id}`}
                        className="font-semibold hover:text-accent"
                      >
                        {o.code}
                      </Link>
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
        </section>
      ) : null}

      {tab === "teklifler" ? (
        <section className="a-card overflow-x-auto">
          {detail.quotes.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-muted">
              Bu firmanın teklif talebi yok.
            </p>
          ) : (
            <table className="a-table">
              <thead>
                <tr>
                  <th>Teklif</th>
                  <th>Durum</th>
                  <th className="text-right">Tutar</th>
                  <th className="text-right">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {detail.quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link
                        href={`/admin/teklifler/${q.id}`}
                        className="font-semibold hover:text-accent"
                      >
                        {q.code}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge map={QUOTE_STATUS} value={q.status} />
                    </td>
                    <td className="text-right tabular-nums">
                      {money(q.totalMinor, q.currency)}
                    </td>
                    <td className="whitespace-nowrap text-right text-[12px] text-muted">
                      {dateTime(q.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "duzenle" ? (
        <div className="a-card max-w-[760px] p-5">
          <CompanyForm
            submitLabel="Değişiklikleri kaydet"
            values={{
              id: company.id,
              name: company.name,
              taxNumber: company.taxNumber ?? "",
              taxOffice: company.taxOffice ?? "",
              country: company.country,
              city: company.city ?? "",
              address: company.address ?? "",
              phone: company.phone ?? "",
              email: company.email ?? "",
              website: company.website ?? "",
              status: company.status,
              discountBp: company.discountBp,
              currency: company.currency,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
