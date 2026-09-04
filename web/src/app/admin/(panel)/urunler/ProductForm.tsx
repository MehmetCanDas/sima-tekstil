"use client";

import { useState } from "react";

import { GENDERS, PRODUCT_STATUS, moneyInput } from "@/lib/admin/format";
import { ActionForm, Field, SubmitButton } from "@/components/admin/ui";
import { ImageFileInput, uploadHint } from "@/components/admin/ImageFileInput";
import type { ActionResult } from "@/lib/admin/action";

/* ---------------------------------------------------------------------------
 * Urun formu. Hem yeni kayit hem duzenleme icin kullanilir.
 *
 * Alanlar bolumlere ayrildi: kimlik, siniflandirma, ticari, icerik, SEO.
 * Zorunlu olan tek alan urun adidir; kalan alanlar bos birakildiginda "veri
 * yok" olarak kaydedilir, uydurma varsayilan yazilmaz.
 * ------------------------------------------------------------------------ */

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  gender: string;
  description: string;
  fabricType: string;
  fabricContent: string;
  features: string[];
  priceMinor: number | null;
  wholesaleMinor: number | null;
  wholesaleMinQty: number | null;
  currency: string;
  moq: number | null;
  moqUnit: string;
  stock: number;
  status: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

type Cat = { id: string; label: string; depth: number };

export function ProductForm({
  action,
  values,
  categories,
  submitLabel,
  stockLocked,
  withImages,
}: {
  action: (
    prev: ActionResult<never> | null,
    formData: FormData,
  ) => Promise<ActionResult<never>>;
  values: ProductFormValues;
  categories: Cat[];
  submitLabel: string;
  /** Varyanti olan urunlerde stok alani duzenlenemez. */
  stockLocked?: boolean;
  /** Yeni urun ekraninda gorseller ayni formda yuklenir. */
  withImages?: boolean;
}) {
  const [name, setName] = useState(values.name);

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      {(state) => {
        const err = (field: string) =>
          state && !state.ok ? state.fieldErrors?.[field] : undefined;

        return (
          <>
            {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

            <Section title="Kimlik">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Ürün adı" name="name" required error={err("name")}>
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      defaultValue={values.name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={200}
                      required
                    />
                  )}
                </Field>
                <Field
                  label="SKU / ürün kodu"
                  name="sku"
                  error={err("sku")}
                  hint="Varyantlı ürünlerde varyant SKU'larının önekidir."
                >
                  {(p) => (
                    <input {...p} className="a-input" defaultValue={values.sku} maxLength={60} />
                  )}
                </Field>
              </div>
              <Field
                label="URL slug"
                name="slug"
                error={err("slug")}
                hint={`Boş bırakılırsa ürün adından üretilir: /urun/${slugPreview(values.slug || name)}`}
              >
                {(p) => (
                  <input {...p} className="a-input" defaultValue={values.slug} maxLength={120} />
                )}
              </Field>
            </Section>

            <Section title="Sınıflandırma">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Kategori" name="categoryId" error={err("categoryId")}>
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.categoryId}>
                      <option value="">— seçilmedi —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Alt kategori" name="subcategoryId" error={err("subcategoryId")}>
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.subcategoryId}>
                      <option value="">— seçilmedi —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Cinsiyet" name="gender" error={err("gender")}>
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.gender}>
                      {Object.entries(GENDERS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            </Section>

            <Section title="Ticari">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Liste fiyatı" name="price" error={err("price")} hint="Örn. 249,90">
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      inputMode="decimal"
                      defaultValue={moneyInput(values.priceMinor)}
                    />
                  )}
                </Field>
                <Field
                  label="Toptan fiyat"
                  name="wholesale"
                  error={err("wholesale")}
                  hint="Boş bırakılırsa tek fiyat uygulanır."
                >
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      inputMode="decimal"
                      defaultValue={moneyInput(values.wholesaleMinor)}
                    />
                  )}
                </Field>
                <Field
                  label="Toptan geçerlilik adedi"
                  name="wholesaleMinQty"
                  error={err("wholesaleMinQty")}
                  hint="Bu adet ve üzerinde toptan fiyat uygulanır."
                >
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      type="number"
                      min={2}
                      placeholder="örn. 40"
                      defaultValue={values.wholesaleMinQty ?? ""}
                    />
                  )}
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Para birimi" name="currency" error={err("currency")}>
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.currency}>
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  )}
                </Field>
                <Field label="Min. sipariş (MOQ)" name="moq" error={err("moq")}>
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      type="number"
                      min={0}
                      defaultValue={values.moq ?? ""}
                    />
                  )}
                </Field>
                <Field label="MOQ birimi" name="moqUnit" error={err("moqUnit")}>
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      placeholder="adet"
                      defaultValue={values.moqUnit}
                      maxLength={30}
                    />
                  )}
                </Field>
                <Field
                  label="Stok"
                  name="stock"
                  error={err("stock")}
                  hint={
                    stockLocked
                      ? "Varyantlar var: toplam stok varyantlardan hesaplanıyor."
                      : undefined
                  }
                >
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      type="number"
                      min={0}
                      defaultValue={values.stock}
                      disabled={stockLocked}
                    />
                  )}
                </Field>
              </div>
            </Section>

            <Section title="İçerik">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kumaş türü" name="fabricType" error={err("fabricType")}>
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      defaultValue={values.fabricType}
                      placeholder="Polar, Softshell, Gabardin…"
                      maxLength={200}
                    />
                  )}
                </Field>
                <Field
                  label="Kumaş içeriği"
                  name="fabricContent"
                  error={err("fabricContent")}
                  hint="Örn. %65 pamuk, %35 polyester"
                >
                  {(p) => (
                    <input
                      {...p}
                      className="a-input"
                      defaultValue={values.fabricContent}
                      maxLength={400}
                    />
                  )}
                </Field>
              </div>
              <Field label="Açıklama" name="description" error={err("description")}>
                {(p) => (
                  <textarea
                    {...p}
                    className="a-textarea"
                    rows={5}
                    defaultValue={values.description}
                    maxLength={8000}
                  />
                )}
              </Field>
              <Field
                label="Ürün özellikleri"
                name="features"
                error={err("features")}
                hint="Her satır bir özellik olarak kaydedilir."
              >
                {(p) => (
                  <textarea
                    {...p}
                    className="a-textarea"
                    rows={4}
                    defaultValue={values.features.join("\n")}
                    maxLength={4000}
                  />
                )}
              </Field>
            </Section>

            {withImages ? (
              <Section title="Görseller">
                <Field
                  label="Ürün görselleri"
                  name="files"
                  hint={`${uploadHint(true)} İlk görsel ana görsel olur; sıralamayı sonra değiştirebilirsiniz.`}
                >
                  {(p) => <ImageFileInput {...p} multiple />}
                </Field>
              </Section>
            ) : null}

            <Section title="Yayın ve SEO">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Durum" name="status" error={err("status")}>
                  {(p) => (
                    <select {...p} className="a-select" defaultValue={values.status}>
                      {Object.entries(PRODUCT_STATUS).map(([value, s]) => (
                        <option key={value} value={value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <label className="flex items-end gap-2 pb-2 text-[14px]">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={values.featured}
                    className="h-4 w-4"
                  />
                  Ana sayfada öne çıkar
                </label>
              </div>
              <Field label="SEO başlığı" name="seoTitle" error={err("seoTitle")}>
                {(p) => (
                  <input
                    {...p}
                    className="a-input"
                    defaultValue={values.seoTitle}
                    maxLength={200}
                    placeholder={name}
                  />
                )}
              </Field>
              <Field
                label="SEO açıklaması"
                name="seoDescription"
                error={err("seoDescription")}
                hint="Arama sonuçlarında görünen özet. 160 karaktere kadar."
              >
                {(p) => (
                  <textarea
                    {...p}
                    className="a-textarea"
                    rows={2}
                    defaultValue={values.seoDescription}
                    maxLength={400}
                  />
                )}
              </Field>
            </Section>

            <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-bg px-1 py-3">
              <SubmitButton>{submitLabel}</SubmitButton>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="a-card p-5">
      <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function slugPreview(value: string): string {
  return (
    value
      .toLocaleLowerCase("tr")
      .replace(/[ğ]/g, "g")
      .replace(/[ü]/g, "u")
      .replace(/[ş]/g, "s")
      .replace(/[ı]/g, "i")
      .replace(/[ö]/g, "o")
      .replace(/[ç]/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "urun-adi"
  );
}
