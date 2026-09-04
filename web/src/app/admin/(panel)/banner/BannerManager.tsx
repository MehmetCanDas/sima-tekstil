"use client";

import Image from "next/image";
import { useState } from "react";

import type { HomeBannerRow } from "@/db/schema";
import {
  deleteBannerAction,
  reorderBannersAction,
  saveBannerAction,
} from "@/lib/admin/banners.actions";
import { ActionForm, ConfirmSubmit, Field, SubmitButton } from "@/components/admin/ui";
import { ImageFileInput, uploadHint } from "@/components/admin/ImageFileInput";
import { Badge } from "@/components/admin/Badge";

/* ---------------------------------------------------------------------------
 * Ana sayfa gorsel yoneticisi.
 *
 * Iki liste ayni bilesenle yonetilir; fark yalnizca hangi alanlarin gosterildigi.
 * Slaytlarda baslik, italik alt baslik ve iki buton var; kartlarda baslik,
 * aciklama ve tek bir baglanti.
 * ------------------------------------------------------------------------ */

type Kind = "slide" | "card";

export function BannerManager({
  slides,
  cards,
  canEdit,
}: {
  slides: HomeBannerRow[];
  cards: HomeBannerRow[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-10">
      <BannerGroup
        kind="slide"
        title="Slaytlar"
        description="Sayfanın en üstünde kayan geniş görseller. En az bir tanesi yayında olmalı."
        rows={slides}
        canEdit={canEdit}
        recommended="1920 × 1080 piksel (16:9)"
      />
      <BannerGroup
        kind="card"
        title="Giriş kartları"
        description="Slaytın altındaki üç kutu. Üçten fazla eklerseniz sayfada alt alta sıralanır."
        rows={cards}
        canEdit={canEdit}
        recommended="800 × 600 piksel (4:3)"
      />
    </div>
  );
}

function BannerGroup({
  kind,
  title,
  description,
  rows,
  canEdit,
  recommended,
}: {
  kind: Kind;
  title: string;
  description: string;
  rows: HomeBannerRow[];
  canEdit: boolean;
  recommended: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<string[]>(rows.map((r) => r.id));
  const [orderDirty, setOrderDirty] = useState(false);

  const ordered = [...rows].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );

  function move(id: string, delta: number) {
    const list = [...order];
    const i = list.indexOf(id);
    const target = i + delta;
    if (i < 0 || target < 0 || target >= list.length) return;
    [list[i], list[target]] = [list[target], list[i]];
    setOrder(list);
    setOrderDirty(true);
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold uppercase">{title}</h2>
          <p className="text-[13px] text-ink-2">{description}</p>
          <p className="mt-0.5 text-[12px] text-muted">Önerilen ölçü: {recommended}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orderDirty && canEdit ? (
            <ActionForm
              action={reorderBannersAction}
              onSuccess={() => setOrderDirty(false)}
              className="flex items-center gap-2"
            >
              {() => (
                <>
                  <input type="hidden" name="kind" value={kind} />
                  {order.map((id) => (
                    <input key={id} type="hidden" name="bannerId" value={id} />
                  ))}
                  <span className="text-[12px] text-warn">Sıralama kaydedilmedi</span>
                  <SubmitButton className="a-btn a-btn-primary a-btn-sm">
                    Sırayı kaydet
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              className="a-btn a-btn-primary a-btn-sm"
              onClick={() => {
                setCreating((v) => !v);
                setEditing(null);
              }}
            >
              {creating ? "Formu kapat" : kind === "slide" ? "Slayt ekle" : "Kart ekle"}
            </button>
          ) : null}
        </div>
      </div>

      {creating ? (
        <div className="a-card mb-4 p-5">
          <BannerForm kind={kind} onDone={() => setCreating(false)} submitLabel="Ekle" />
        </div>
      ) : null}

      <div className="a-card">
        {ordered.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-muted">
            Henüz kayıt yok. {kind === "slide" ? "Slayt" : "Kart"} ekleyin.
          </p>
        ) : (
          <ul>
            {ordered.map((row, i) => (
              <li key={row.id} className="border-b border-line last:border-b-0">
                <div className="flex flex-wrap items-center gap-4 p-4">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt=""
                      width={160}
                      height={90}
                      className="h-[62px] w-[110px] shrink-0 border border-line object-cover"
                    />
                  ) : (
                    <div className="grid h-[62px] w-[110px] shrink-0 place-items-center border border-line bg-surface text-[11px] text-muted">
                      görsel yok
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{row.title ?? "(başlıksız)"}</span>
                      {row.status !== "active" ? (
                        <Badge tone="mute">Gizli</Badge>
                      ) : null}
                    </div>
                    <p className="text-[12px] text-muted">
                      {[row.eyebrow, row.accentTitle, row.subtitle]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    {row.ctaHref ? (
                      <p className="text-[11px] text-muted">→ {row.ctaHref}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="a-btn a-btn-ghost a-btn-sm"
                      onClick={() => move(row.id, -1)}
                      disabled={i === 0 || !canEdit}
                      aria-label="Yukarı taşı"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="a-btn a-btn-ghost a-btn-sm"
                      onClick={() => move(row.id, 1)}
                      disabled={i === ordered.length - 1 || !canEdit}
                      aria-label="Aşağı taşı"
                    >
                      ↓
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          className="a-btn a-btn-ghost a-btn-sm"
                          onClick={() => setEditing(editing === row.id ? null : row.id)}
                        >
                          {editing === row.id ? "Kapat" : "Düzenle"}
                        </button>
                        <ActionForm action={deleteBannerAction}>
                          {() => (
                            <>
                              <input type="hidden" name="id" value={row.id} />
                              <ConfirmSubmit
                                className="a-btn a-btn-danger a-btn-sm"
                                title="Kayıt silinsin mi?"
                                body="Bu görsel ana sayfadan kaldırılır ve yüklenen dosya silinir. Geri alınamaz."
                                confirmLabel="Sil"
                              >
                                Sil
                              </ConfirmSubmit>
                            </>
                          )}
                        </ActionForm>
                      </>
                    ) : null}
                  </div>
                </div>

                {editing === row.id ? (
                  <div className="border-t border-line bg-surface p-5">
                    <BannerForm
                      kind={kind}
                      row={row}
                      onDone={() => setEditing(null)}
                      submitLabel="Kaydet"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BannerForm({
  kind,
  row,
  onDone,
  submitLabel,
}: {
  kind: Kind;
  row?: HomeBannerRow;
  onDone: () => void;
  submitLabel: string;
}) {
  const isSlide = kind === "slide";

  return (
    <ActionForm action={saveBannerAction} onSuccess={onDone} className="flex flex-col gap-4">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            <input type="hidden" name="kind" value={kind} />
            {row ? <input type="hidden" name="id" value={row.id} /> : null}

            <Field
              label="Görsel"
              name="image"
              required={!row}
              error={err("image")}
              hint={
                row
                  ? `Boş bırakırsanız mevcut görsel korunur. ${uploadHint()}`
                  : uploadHint()
              }
            >
              {(p) => <ImageFileInput {...p} required={!row} />}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              {isSlide ? (
                <Field label="Üst etiket" name="eyebrow" error={err("eyebrow")}>
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      defaultValue={row?.eyebrow ?? ""}
                      placeholder="Kurumsal & endüstriyel"
                    />
                  )}
                </Field>
              ) : null}

              <Field label="Başlık" name="title" error={err("title")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={row?.title ?? ""} />
                )}
              </Field>
            </div>

            {isSlide ? (
              <Field
                label="İtalik alt başlık"
                name="accentTitle"
                error={err("accentTitle")}
                hint="Başlığın altında turuncu, el yazısı hissi veren satır."
              >
                {(p) => (
                  <input {...p} className="a-input" defaultValue={row?.accentTitle ?? ""} />
                )}
              </Field>
            ) : (
              <Field label="Açıklama" name="subtitle" error={err("subtitle")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={row?.subtitle ?? ""} />
                )}
              </Field>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {isSlide ? (
                <Field label="Buton yazısı" name="ctaLabel" error={err("ctaLabel")}>
                  {(p) => (
                    <input {...p} className="a-input" defaultValue={row?.ctaLabel ?? ""} />
                  )}
                </Field>
              ) : null}
              <Field
                label={isSlide ? "Buton bağlantısı" : "Kartın bağlantısı"}
                name="ctaHref"
                error={err("ctaHref")}
                hint="Site içi yol olmalı, örn. /urunler"
              >
                {(p) => (
                  <input
                    {...p}
                    className="a-input"
                    defaultValue={row?.ctaHref ?? ""}
                    placeholder="/urunler"
                  />
                )}
              </Field>
            </div>

            {isSlide ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="İkinci buton yazısı" name="cta2Label" error={err("cta2Label")}>
                  {(p) => (
                    <input {...p} className="a-input" defaultValue={row?.cta2Label ?? ""} />
                  )}
                </Field>
                <Field label="İkinci buton bağlantısı" name="cta2Href" error={err("cta2Href")}>
                  {(p) => (
                    <input {...p} className="a-input" defaultValue={row?.cta2Href ?? ""} />
                  )}
                </Field>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Kırpma odağı"
                name="focus"
                error={err("focus")}
                hint="Ekran oranı görselden farklıysa hangi kenar korunsun."
              >
                {(p) => (
                  <select {...p} className="a-select" defaultValue={row?.focus ?? ""}>
                    <option value="">Orta (varsayılan)</option>
                    <option value="center top">Üst</option>
                    <option value="center bottom">Alt</option>
                    <option value="left center">Sol</option>
                    <option value="right center">Sağ</option>
                  </select>
                )}
              </Field>
              <Field label="Durum" name="status" error={err("status")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={row?.status ?? "active"}>
                    <option value="active">Yayında</option>
                    <option value="hidden">Gizli</option>
                  </select>
                )}
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <SubmitButton pendingText="Yükleniyor…">{submitLabel}</SubmitButton>
              <button type="button" className="a-btn a-btn-ghost" onClick={onDone}>
                Vazgeç
              </button>
              {state && !state.ok ? (
                <span className="text-[13px] text-[#b3261e]">{state.error}</span>
              ) : null}
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
