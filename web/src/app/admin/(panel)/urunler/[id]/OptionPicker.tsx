"use client";

import { setProductOptionsAction } from "@/lib/admin/products.actions";
import { ActionForm, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Urunun renk ve beden eksenleri.
 *
 * Varyantlar bu iki listenin carpimindan uretilir; bu yuzden varyant tablosunun
 * hemen ustunde durur. Burada bir secenegi kaldirmak varolan varyanti silmez -
 * varyant tablosundan acikca kaldirilmasi gerekir, boylece stok kazara kaybolmaz.
 * ------------------------------------------------------------------------ */

type Color = { id: string; name: string; hex: string };
type Size = { id: string; name: string };

export function OptionPicker({
  productId,
  allColors,
  allSizes,
  selectedColorIds,
  selectedSizeIds,
  canUpdate,
}: {
  productId: string;
  allColors: Color[];
  allSizes: Size[];
  selectedColorIds: string[];
  selectedSizeIds: string[];
  canUpdate: boolean;
}) {
  const colorSet = new Set(selectedColorIds);
  const sizeSet = new Set(selectedSizeIds);

  return (
    <section className="a-card p-5">
      <h2 className="mb-1 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        Renk ve beden seçenekleri
      </h2>
      <p className="mb-4 text-[13px] text-muted">
        Seçtiğiniz renkler ve bedenler varyant tablosunun eksenleridir.
      </p>

      <ActionForm action={setProductOptionsAction} className="flex flex-col gap-5">
        {() => (
          <>
            <input type="hidden" name="id" value={productId} />

            <fieldset disabled={!canUpdate}>
              <legend className="a-label">Renkler</legend>
              <div className="flex flex-wrap gap-2">
                {allColors.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 border border-line px-2.5 py-1.5 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                  >
                    <input
                      type="checkbox"
                      name="colorId"
                      value={c.id}
                      defaultChecked={colorSet.has(c.id)}
                      className="h-3.5 w-3.5"
                    />
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 border border-line-strong"
                      style={{ background: c.hex }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={!canUpdate}>
              <legend className="a-label">Bedenler</legend>
              <div className="flex flex-wrap gap-2">
                {allSizes.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 border border-line px-3 py-1.5 text-[13px] font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                  >
                    <input
                      type="checkbox"
                      name="sizeId"
                      value={s.id}
                      defaultChecked={sizeSet.has(s.id)}
                      className="h-3.5 w-3.5"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>

            {canUpdate ? (
              <div>
                <SubmitButton>Seçenekleri kaydet</SubmitButton>
              </div>
            ) : null}
          </>
        )}
      </ActionForm>
    </section>
  );
}
