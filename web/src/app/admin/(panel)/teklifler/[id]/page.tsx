import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { getQuoteDetail } from "@/lib/admin/sales";
import { QUOTE_STATUS, dateTime, dateOnly } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/Badge";
import { ConvertQuoteForm, QuoteEditor } from "./QuoteEditor";

export const metadata: Metadata = { title: "Teklif" };

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("quote.read");
  const me = (await getCurrentUser())!;
  const { id } = await params;

  const detail = getQuoteDetail(id);
  if (!detail) notFound();
  const { quote, items } = detail;

  const canUpdate = me.permissions.has("quote.update");
  const canConvert = me.permissions.has("quote.convert");
  const pricesReady =
    items.length > 0 && items.every((i) => i.quotedPriceMinor !== null);

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/admin/teklifler" className="text-[13px] text-muted hover:text-ink">
        ← Teklifler
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-[26px] font-bold uppercase">{quote.code}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted">
            <StatusBadge map={QUOTE_STATUS} value={quote.status} />
            <span>{dateTime(quote.createdAt)}</span>
            {quote.validUntil ? (
              <span>geçerlilik {dateOnly(quote.validUntil)}</span>
            ) : null}
          </div>
        </div>
        {quote.convertedOrderId ? (
          <Link
            href={`/admin/siparisler/${quote.convertedOrderId}`}
            className="a-btn a-btn-ghost"
          >
            Oluşan siparişi aç →
          </Link>
        ) : canConvert && pricesReady ? (
          <ConvertQuoteForm quoteId={quote.id} />
        ) : null}
      </div>

      <section className="a-card mb-5">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Talep eden
          </h2>
        </header>
        <dl className="grid gap-px bg-line sm:grid-cols-3">
          <Info label="Firma">
            {quote.companyId ? (
              <Link
                href={`/admin/firmalar/${quote.companyId}`}
                className="font-semibold hover:text-accent"
              >
                {quote.registeredCompany}
              </Link>
            ) : (
              (quote.companyName ?? "—")
            )}
          </Info>
          <Info label="Yetkili">
            {quote.userId ? (
              <Link
                href={`/admin/musteriler/${quote.userId}`}
                className="font-semibold hover:text-accent"
              >
                {`${quote.userName ?? ""} ${quote.userSurname ?? ""}`.trim() ||
                  quote.contactName}
              </Link>
            ) : (
              (quote.contactName ?? "—")
            )}
          </Info>
          <Info label="Şehir">{quote.city ?? "—"}</Info>
          <Info label="E-posta">{quote.email ?? "—"}</Info>
          <Info label="Telefon">{quote.phone ?? "—"}</Info>
          <Info label="Hesap">
            {quote.userId ? "Kayıtlı kullanıcı" : "Üyeliksiz talep"}
          </Info>
        </dl>
        {quote.note ? (
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
              Müşterinin notu
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{quote.note}</p>
          </div>
        ) : null}
      </section>

      <QuoteEditor
        quote={{
          id: quote.id,
          code: quote.code,
          status: quote.status,
          currency: quote.currency,
          note: quote.note,
          adminNote: quote.adminNote,
          validUntil: quote.validUntil,
          convertedOrderId: quote.convertedOrderId,
        }}
        items={items}
        canUpdate={canUpdate}
        canConvert={canConvert}
      />
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
