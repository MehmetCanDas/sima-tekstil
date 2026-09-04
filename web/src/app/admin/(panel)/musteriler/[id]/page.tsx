import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { companyOptions, getUserDetail } from "@/lib/admin/customers";
import { deleteUserAction } from "@/lib/admin/customers.actions";
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
import { StatusActions } from "../StatusActions";
import { UserForm } from "../UserForm";
import { ArchiveAccountButton } from "./ArchiveAccountButton";

export const metadata: Metadata = { title: "Müşteri" };

const EVENT_LABEL: Record<string, string> = {
  product_view: "Ürün görüntüledi",
  cart_add: "Teklif sepetine ekledi",
  quote_request: "Teklif talebi gönderdi",
  login: "Giriş yaptı",
  search: "Arama yaptı",
};

export default async function CustomerDetailPage({
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

  const detail = getUserDetail(id);
  if (!detail) notFound();

  const { user } = detail;
  const tabs = [
    { id: "ozet", label: "Özet" },
    { id: "siparisler", label: `Siparişler (${detail.orders.length})` },
    { id: "teklifler", label: `Teklifler (${detail.quotes.length})` },
    { id: "aktivite", label: "Aktivite" },
    ...(me.permissions.has("customer.update")
      ? [{ id: "duzenle", label: "Hesabı düzenle" }]
      : []),
  ];
  const tab = tabs.some((t) => t.id === rawTab) ? rawTab! : "ozet";

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/musteriler" className="text-[13px] text-muted hover:text-ink">
        ← Kullanıcılar
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold uppercase">
            {`${user.name} ${user.surname}`.trim()}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <StatusBadge map={ACCOUNT_STATUS} value={user.status} />
            <span>{ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role}</span>
            <span>{user.email}</span>
            {user.deletedAt ? <span className="text-[#b3261e]">arşivlenmiş</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusActions
            userId={user.id}
            status={user.status}
            canApprove={me.permissions.has("customer.approve")}
            canSuspend={me.permissions.has("customer.suspend")}
          />
          {me.permissions.has("customer.delete") ? (
            <ArchiveAccountButton
              action={deleteUserAction}
              id={user.id}
              archived={user.deletedAt !== null}
            />
          ) : null}
        </div>
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/musteriler/${id}?tab=${t.id}`}
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
          <div className="flex flex-col gap-5">
            <section className="a-card">
              <header className="border-b border-line px-4 py-3">
                <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                  Müşteri bilgileri
                </h2>
              </header>
              <dl className="grid gap-px bg-line sm:grid-cols-2">
                <Info label="Firma">
                  {user.companyId ? (
                    <Link
                      href={`/admin/firmalar/${user.companyId}`}
                      className="font-semibold hover:text-accent"
                    >
                      {user.companyName}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Info>
                <Info label="Yetkili">{`${user.name} ${user.surname}`.trim()}</Info>
                <Info label="E-posta">{user.email}</Info>
                <Info label="Telefon">{user.phone ?? "—"}</Info>
                <Info label="Ülke / şehir">
                  {[user.companyCountry, user.companyCity].filter(Boolean).join(" / ") || "—"}
                </Info>
                <Info label="Adres">{user.companyAddress ?? "—"}</Info>
                <Info label="Kayıt tarihi">{dateTime(user.createdAt)}</Info>
                <Info label="Onay tarihi">{dateTime(user.approvedAt)}</Info>
                <Info label="Son giriş">
                  {dateTime(user.lastLoginAt)}
                  {user.lastLoginIp ? (
                    <span className="ml-2 text-[11px] text-muted">{user.lastLoginIp}</span>
                  ) : null}
                </Info>
                <Info label="Favoriler">{detail.favorites.length} ürün</Info>
              </dl>
            </section>

            {detail.favorites.length > 0 ? (
              <section className="a-card">
                <header className="border-b border-line px-4 py-3">
                  <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
                    Favorileri
                  </h2>
                </header>
                <ul className="grid gap-px bg-line sm:grid-cols-2">
                  {detail.favorites.map((f) => (
                    <li key={f.productId} className="bg-bg px-4 py-2.5 text-[13px]">
                      <Link
                        href={`/admin/urunler/${f.productId}`}
                        className="font-semibold hover:text-accent"
                      >
                        {f.name}
                      </Link>
                      <div className="text-[11px] text-muted">{relative(f.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <NotesPanel
            notes={detail.notes}
            userId={user.id}
            canWrite={me.permissions.has("customer.update")}
          />
        </div>
      ) : null}

      {tab === "siparisler" ? (
        <section className="a-card overflow-x-auto">
          {detail.orders.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-muted">
              Bu kullanıcının siparişi yok.
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
              Bu kullanıcının teklif talebi yok.
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

      {tab === "aktivite" ? (
        <section className="a-card">
          {detail.events.length === 0 ? (
            <p className="px-4 py-12 text-center text-[13px] text-muted">
              Henüz aktivite kaydı yok. Ürün görüntüleme ve sepete ekleme olayları
              vitrin tarafı bağlandığında burada birikir.
            </p>
          ) : (
            <ul>
              {detail.events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-baseline gap-x-3 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0"
                >
                  <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>
                  {e.productId ? (
                    <Link
                      href={`/admin/urunler/${e.productId}`}
                      className="text-accent hover:underline"
                    >
                      {e.productName}
                    </Link>
                  ) : null}
                  <span className="ml-auto text-[11px] text-muted">
                    {dateTime(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "duzenle" ? (
        <div className="a-card max-w-[760px] p-5">
          <UserForm
            submitLabel="Değişiklikleri kaydet"
            companies={companyOptions()}
            canAssignStaffRole={me.permissions.has("staff.manage")}
            values={{
              id: user.id,
              email: user.email,
              name: user.name,
              surname: user.surname,
              phone: user.phone ?? "",
              companyId: user.companyId ?? "",
              role: user.role,
              status: user.status,
            }}
          />
        </div>
      ) : null}
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
