"use client";

import { Img as Image } from "@/components/Img";
import Link from "next/link";
import { useEffect, useState } from "react";
import { remainingQty, useQuote, type QuoteLine } from "@/lib/quote-store";
import { scaleLabel, sizeKeys, sizeTotal } from "@/lib/sizes";
import { money } from "@/lib/admin/format";
import { hasWholesaleTier, priceFor } from "@/lib/pricing";

type Status = "idle" | "sending" | "ok" | "error";

export default function QuoteRequest() {
  const {
    lines,
    totalQty,
    totalMinor,
    hasUnpricedLines,
    incompleteLines,
    setQty,
    setSize,
    autoFillSizes,
    clearSizes,
    remove,
    clear,
    ready,
  } = useQuote();
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Liste uyarisi, kullanici dagilimi duzeltir duzeltmez kalkmali; aksi halde
  // "100 / 100 adet tamam" yazarken altta hala "tamamlanmadi" gorunuyordu.
  useEffect(() => {
    if (lines.length === 0 || incompleteLines.length > 0) return;
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const { lines: _resolved, ...rest } = prev;
      return rest;
    });
  }, [lines.length, incompleteLines.length]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      company: String(fd.get("company") ?? "").trim(),
      contact: String(fd.get("contact") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      city: String(fd.get("city") ?? "").trim(),
      note: String(fd.get("note") ?? "").trim(),
      // Bot tuzagi: gercek kullanici bu alani doldurmaz.
      website: String(fd.get("website") ?? ""),
      lines,
    };

    const next: Record<string, string> = {};
    if (payload.company.length < 2) next.company = "Firma adı gerekli.";
    if (payload.contact.length < 2) next.contact = "Yetkili kişi gerekli.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) next.email = "Geçerli bir e-posta girin.";
    if (payload.phone.replace(/\D/g, "").length < 10) next.phone = "Geçerli bir telefon girin.";
    if (lines.length === 0) next.lines = "Teklif listeniz boş.";
    else if (incompleteLines.length > 0) {
      // Beden dagilimi tamamlanmadan teklif hazirlanamaz: uretim adedi
      // bedene gore planlanir.
      next.lines = `Beden dağılımı tamamlanmadı: ${incompleteLines
        .map((l) => l.name)
        .join(", ")}.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/teklif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; reference?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Gönderilemedi");
      setReference(data.reference ?? null);
      setStatus("ok");
      clear();
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="u-wrap py-20">
        <div className="max-w-[54ch] border border-line-strong p-8">
          <h2 className="text-[30px] font-semibold uppercase">Talebiniz alındı</h2>
          <p className="mt-3 text-[16px] text-ink-2">
            Teklif numaranız:{" "}
            <span className="font-mono font-semibold text-accent">{reference}</span>
          </p>
          <p className="mt-3 text-[15px] text-ink-2">
            Talebiniz satış ekibine iletildi. Aynı gün içinde dönüş yapılacak.
          </p>
          <Link href="/urunler" className="u-btn u-btn-ghost mt-6">
            Katalogu incelemeye devam et
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="u-wrap grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* ------------------------------------------------------ Teklif listesi */}
      <section>
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-[26px] font-semibold uppercase">Teklif listeniz</h2>
          <span className="text-[14px] tabular-nums text-muted">
            {ready
              ? `${lines.length} ürün · ${totalQty} adet${
                  totalMinor > 0 ? ` · ${money(totalMinor)}` : ""
                }`
              : "yükleniyor…"}
          </span>
        </div>

        {ready && lines.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-14">
            <p className="text-[17px] font-semibold">Listeniz boş.</p>
            <p className="max-w-[46ch] text-[15px] text-ink-2">
              Katalogdan ürün ekleyin ya da aşağıdaki forma notunuzu yazarak doğrudan
              teklif isteyin.
            </p>
            <Link href="/urunler" className="u-btn u-btn-primary mt-1">
              Ürünleri Keşfet
            </Link>
          </div>
        )}

        <ul className="divide-y divide-line">
          {lines.map((l) => (
            <QuoteRow
              key={`${l.slug}-${l.colorId}`}
              line={l}
              onQty={(qty) => setQty(l.slug, l.colorId, qty)}
              onSize={(size, qty) => setSize(l.slug, l.colorId, size, qty)}
              onAutoFill={() => autoFillSizes(l.slug, l.colorId)}
              onClearSizes={() => clearSizes(l.slug, l.colorId)}
              onRemove={() => remove(l.slug, l.colorId)}
            />
          ))}
        </ul>

        {lines.length > 0 && (
          <>
            <div className="mt-4 border-t border-line-strong pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <span className="text-[15px]">
                  Toplam <strong className="tabular-nums">{totalQty}</strong> adet
                </span>
                {totalMinor > 0 && (
                  <span className="font-display text-[28px] font-bold leading-none tabular-nums">
                    {money(totalMinor)}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[12px] text-muted">
                  {hasUnpricedLines
                    ? "Fiyatı girilmemiş ürünler toplama dahil değil; teklifte belirtilecek."
                    : "Tutar bilgilendirme amaçlıdır; kesin fiyat teklifte onaylanır."}
                </span>
                <button
                  type="button"
                  onClick={clear}
                  className="text-[14px] text-muted hover:text-accent"
                >
                  Listeyi temizle
                </button>
              </div>
            </div>

            {incompleteLines.length > 0 && (
              <p
                role="status"
                className="mt-3 border-l-2 border-warn bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-ink-2"
              >
                <strong className="font-semibold">Beden dağılımı eksik.</strong> Her ürün
                için girdiğiniz toplam adedi bedenlere dağıtın; toplamlar eşitlenmeden
                teklif gönderilemez. Aksesuar ve promosyon ürünleri tek bedendir, onlarda
                dağılım istenmez.
              </p>
            )}
          </>
        )}
      </section>

      {/* -------------------------------------------------------------- Form */}
      <section>
        <h2 className="border-b border-line pb-3 text-[26px] font-semibold uppercase">
          Firma bilgileri
        </h2>
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
          <Field name="company" label="Firma adı" required error={errors.company} />
          <Field name="contact" label="Yetkili kişi" required error={errors.contact} />
          <Field
            name="email"
            label="E-posta"
            type="email"
            autoComplete="email"
            required
            error={errors.email}
          />
          <Field
            name="phone"
            label="Telefon"
            type="tel"
            autoComplete="tel"
            required
            error={errors.phone}
          />
          <Field name="city" label="Şehir" />

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Not</span>
            <textarea
              name="note"
              rows={4}
              placeholder="Logo uygulaması, beden dağılımı, teslim tarihi…"
              className="border border-line-strong p-3 text-[15px] outline-none focus:border-accent"
            />
          </label>

          {/* Honeypot — ekranda ve ekran okuyucuda gizli. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0"
          />

          {errors.lines && <p className="text-[14px] text-accent">{errors.lines}</p>}
          {status === "error" && (
            <p className="text-[14px] text-accent">
              Talep gönderilemedi. Lütfen tekrar deneyin ya da bizi arayın.
            </p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="u-btn u-btn-primary mt-2 disabled:opacity-60"
          >
            {status === "sending" ? "Gönderiliyor…" : "Teklif Talebi Gönder"}
          </button>

          <p className="text-[13px] leading-relaxed text-muted">
            Bilgileriniz yalnızca teklif hazırlamak için kullanılır. Aydınlatma metni
            ve KVKK onay akışı, yasal firma bilgileri tamamlandığında eklenecek.
          </p>
        </form>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Liste satiri: urun, toplam adet ve beden dagilimi.
 *
 * Toplam adet ustadir. Bedenler onu tamamlamak zorundadir; kalan/fazla adet
 * her zaman gorunur, boylece kullanici neyi duzeltmesi gerektigini aramaz.
 * ------------------------------------------------------------------------ */

function QuoteRow({
  line,
  onQty,
  onSize,
  onAutoFill,
  onClearSizes,
  onRemove,
}: {
  line: QuoteLine;
  onQty: (qty: number) => void;
  onSize: (size: string, qty: number) => void;
  onAutoFill: () => void;
  onClearSizes: () => void;
  onRemove: () => void;
}) {
  const keys = sizeKeys(line.scale);
  const distributed = sizeTotal(line.sizes, line.scale);
  const remaining = remainingQty(line);
  const done = remaining === 0 && line.qty > 0;
  const price = priceFor(line, line.qty);
  const tier = hasWholesaleTier(line);

  return (
    <li className="py-5">
      <div className="flex items-start gap-4">
        <div className="u-plate relative h-20 w-16 shrink-0">
          {line.image && (
            <Image src={line.image} alt="" fill sizes="64px" className="object-contain p-1" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/urun/${line.slug}`} className="font-semibold hover:text-accent">
            {line.name}
          </Link>
          <p className="text-[13px] text-muted">
            {line.colorName ?? "Renk belirtilmedi"}
          </p>

          {line.priceMinor !== null ? (
            <p className="mt-1 text-[13px]">
              <span className="tabular-nums">
                {money(price.unitMinor, line.currency)} × {line.qty}
              </span>
              {price.wholesaleApplied && (
                <span className="ml-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-ok">
                  toptan
                </span>
              )}
              {tier && !price.wholesaleApplied && price.qtyToWholesale !== null && (
                <span className="ml-2 text-[12px] text-accent">
                  {price.qtyToWholesale} adet daha eklerseniz birim fiyat{" "}
                  {money(line.wholesaleMinor, line.currency)}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">Fiyat teklifle belirlenecek</p>
          )}
        </div>

        {line.priceMinor !== null && (
          <span className="hidden shrink-0 self-center font-display text-[19px] font-bold tabular-nums sm:block">
            {money(price.totalMinor, line.currency)}
          </span>
        )}

        <label className="flex flex-col items-end gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Adet
          </span>
          <input
            type="number"
            min={1}
            value={line.qty}
            onChange={(e) => onQty(Number(e.target.value) || 0)}
            aria-label={`${line.name} toplam adet`}
            className="h-10 w-24 border border-line-strong px-2 text-right text-[15px] font-semibold tabular-nums outline-none focus:border-accent"
          />
        </label>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`${line.name} ürününü listeden çıkar`}
          className="px-1 pt-6 text-xl leading-none text-muted hover:text-accent"
        >
          ×
        </button>
      </div>

      {/* ------------------------------------------------- Beden dagilimi */}
      {keys.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          Tek beden — bu üründe beden dağılımı gerekmiyor.
        </p>
      ) : (
      <div
        className={`mt-4 border p-4 transition-colors ${
          done ? "border-line bg-surface" : "border-warn/45 bg-accent-soft/60"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
            {scaleLabel(line.scale)}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-[13px] font-semibold tabular-nums ${
                done ? "text-ok" : "text-warn"
              }`}
            >
              {done
                ? `${distributed} / ${line.qty} adet tamam`
                : remaining > 0
                  ? `${remaining} adet dağıtılmadı`
                  : `${Math.abs(remaining)} adet fazla`}
            </span>
            <button
              type="button"
              onClick={onAutoFill}
              className="text-[13px] text-muted underline underline-offset-2 hover:text-accent"
            >
              eşit dağıt
            </button>
            {distributed > 0 && (
              <button
                type="button"
                onClick={onClearSizes}
                className="text-[13px] text-muted underline underline-offset-2 hover:text-accent"
              >
                sıfırla
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {keys.map((size) => (
            <label key={size} className="flex flex-col gap-1">
              <span className="text-center text-[12px] font-semibold text-ink-2">
                {size}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={line.sizes[size] ?? ""}
                placeholder="0"
                onChange={(e) => onSize(size, Number(e.target.value) || 0)}
                aria-label={`${line.name} ${size} beden adedi`}
                className="h-10 w-full border border-line-strong bg-bg px-2 text-center text-[14px] tabular-nums outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
      </div>
      )}
    </li>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  error,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={`h-11 border px-3 text-[15px] outline-none focus:border-accent ${
          error ? "border-accent" : "border-line-strong"
        }`}
      />
      {error && <span className="text-[13px] text-accent">{error}</span>}
    </label>
  );
}
