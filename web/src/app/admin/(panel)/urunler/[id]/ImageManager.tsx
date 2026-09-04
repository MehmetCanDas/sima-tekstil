"use client";

import { Img as Image } from "@/components/Img";
import { useState } from "react";

import {
  deleteImageAction,
  reorderImagesAction,
  setPrimaryImageAction,
  uploadImagesAction,
} from "@/lib/admin/products.actions";
import { ActionForm, EmptyState, SubmitButton } from "@/components/admin/ui";
import { ImageFileInput, uploadHint } from "@/components/admin/ImageFileInput";

/* ---------------------------------------------------------------------------
 * Gorsel yonetimi: yukle, sirala, ana gorsel sec, sil.
 *
 * Siralama yukari/asagi butonlariyla yapilir. Surukle-birak yerine buton
 * kullanildi: klavyeyle ve dokunmatikte de calisir, ekran okuyucuda anlasilir.
 * ------------------------------------------------------------------------ */

type ImageRow = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

export function ImageManager({
  productId,
  images,
  canUpdate,
}: {
  productId: string;
  images: ImageRow[];
  canUpdate: boolean;
}) {
  const [order, setOrder] = useState<ImageRow[]>(images);
  const [dirty, setDirty] = useState(false);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-6">
      {canUpdate ? (
        <section className="a-card p-5">
          <h2 className="mb-1 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Görsel yükle
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {uploadHint(true)} Yüklenen görseller sitede otomatik olarak boyutlandırılıp
            WebP olarak sunulur.
          </p>
          <ActionForm
            action={uploadImagesAction}
            className="flex flex-wrap items-center gap-3"
            resetOnSuccess
          >
            {() => (
              <>
                <input type="hidden" name="id" value={productId} />
                <div className="max-w-[380px] flex-1">
                  <ImageFileInput name="files" multiple required />
                </div>
                <SubmitButton pendingText="Yükleniyor…">Yükle</SubmitButton>
              </>
            )}
          </ActionForm>
        </section>
      ) : null}

      <section className="a-card">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Galeri ({order.length})
          </h2>
          {dirty && canUpdate ? (
            <ActionForm
              action={reorderImagesAction}
              onSuccess={() => setDirty(false)}
              className="flex items-center gap-2"
            >
              {() => (
                <>
                  <input type="hidden" name="id" value={productId} />
                  {order.map((img) => (
                    <input key={img.id} type="hidden" name="imageId" value={img.id} />
                  ))}
                  <span className="text-[12px] text-warn">Sıralama kaydedilmedi</span>
                  <SubmitButton className="a-btn a-btn-primary a-btn-sm">
                    Sırayı kaydet
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          ) : null}
        </header>

        {order.length === 0 ? (
          <EmptyState
            title="Görsel yok"
            body="Bu ürünün henüz görseli yok. Yukarıdaki alandan yükleyebilirsiniz."
          />
        ) : (
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {order.map((img, i) => (
              <li key={img.id} className="flex gap-3 bg-bg p-3">
                <Image
                  src={img.url}
                  alt={img.alt ?? ""}
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 border border-line object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold tabular-nums text-muted">
                      #{i + 1}
                    </span>
                    {img.isPrimary || i === 0 ? (
                      <span className="a-badge a-badge-ok">Ana görsel</span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted" title={img.url}>
                    {img.url.split("/").pop()}
                  </p>

                  {canUpdate ? (
                    <div className="mt-auto flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="a-btn a-btn-ghost a-btn-sm"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Yukarı taşı"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="a-btn a-btn-ghost a-btn-sm"
                        onClick={() => move(i, 1)}
                        disabled={i === order.length - 1}
                        aria-label="Aşağı taşı"
                      >
                        ↓
                      </button>
                      {/* Form her zaman durur; islem basarili olunca kaldirilsa
                          basari bildirimi gosterilemeden kaybolurdu. */}
                      <ActionForm action={setPrimaryImageAction}>
                        {() => (
                          <>
                            <input type="hidden" name="imageId" value={img.id} />
                            <SubmitButton
                              className="a-btn a-btn-ghost a-btn-sm"
                              pendingText="…"
                              disabled={img.isPrimary}
                            >
                              Ana yap
                            </SubmitButton>
                          </>
                        )}
                      </ActionForm>
                      <ActionForm
                        action={deleteImageAction}
                        onSuccess={() =>
                          setOrder((list) => list.filter((x) => x.id !== img.id))
                        }
                      >
                        {() => (
                          <>
                            <input type="hidden" name="imageId" value={img.id} />
                            <SubmitButton
                              className="a-btn a-btn-danger a-btn-sm"
                              pendingText="…"
                            >
                              Sil
                            </SubmitButton>
                          </>
                        )}
                      </ActionForm>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
