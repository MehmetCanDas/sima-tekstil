"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { WORLDS } from "@/lib/catalog";
import { filterProducts, makeCatalogIndex } from "@/lib/product-filter";
import type {
  Filters,
  StoreCategory,
  StoreColorRef,
  StoreProduct,
  StoreSector,
} from "@/lib/product-types";

type Props = {
  products: StoreProduct[];
  categories: StoreCategory[];
  sectors: StoreSector[];
  colors: StoreColorRef[];
  initial: Filters;
};

export default function CatalogBrowser({
  products,
  categories,
  sectors,
  colors,
  initial,
}: Props) {
  const [f, setF] = useState<Filters>(initial);
  const [drawer, setDrawer] = useState(false);

  // Kategori/sektor adlari props'tan gelir; filtre saf fonksiyondur.
  const index = useMemo(
    () => makeCatalogIndex(categories, sectors),
    [categories, sectors],
  );
  const results = useMemo(
    () => filterProducts(products, f, index),
    [products, f, index],
  );

  const visibleCategories = useMemo(
    () =>
      categories.filter((c) => !c.parentId && (!f.world || c.world === f.world)),
    [categories, f.world],
  );

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((prev) => {
      const next = { ...prev, [k]: prev[k] === v ? undefined : v };
      // Dünya değişince, o dünyaya ait olmayan kategori seçimi düşer.
      if (k === "world" && next.category && index.worldOf(next.category) !== next.world) {
        next.category = undefined;
      }
      return next;
    });

  const activeCount = [f.world, f.category, f.sector, f.color].filter(Boolean).length;

  /* Secili filtreler baslikta etiket olarak gosterilir: kullanici hangi
     kisitla kac urun gordugunu izgaraya bakmadan anlar. */
  const chips = useMemo(() => {
    const out: { key: keyof Filters; label: string }[] = [];
    const world = WORLDS.find((w) => w.id === f.world);
    if (world) out.push({ key: "world", label: world.name });
    const cat = categories.find((c) => c.id === f.category);
    if (cat) out.push({ key: "category", label: cat.name });
    const sec = sectors.find((x) => x.id === f.sector);
    if (sec) out.push({ key: "sector", label: sec.name });
    const col = colors.find((c) => c.id === f.color);
    if (col) out.push({ key: "color", label: col.name });
    return out;
  }, [f, categories, sectors, colors]);

  const filters = (
    <div className="flex flex-col gap-7">
      <Group title="Ürün grubu">
        {WORLDS.map((w) => (
          <Check key={w.id} on={f.world === w.id} onClick={() => set("world", w.id)}>
            {w.name}
          </Check>
        ))}
      </Group>

      <Group title="Kategori">
        {visibleCategories.map((c) => (
          <Check key={c.id} on={f.category === c.id} onClick={() => set("category", c.id)}>
            {c.name}
          </Check>
        ))}
      </Group>

      <Group title="Sektör">
        {sectors.map((s) => (
          <Check key={s.id} on={f.sector === s.id} onClick={() => set("sector", s.id)}>
            {s.name}
          </Check>
        ))}
      </Group>

      <Group title="Renk">
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set("color", c.id)}
              title={c.name}
              aria-pressed={f.color === c.id}
              aria-label={c.name}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                f.color === c.id
                  ? "scale-110 border-accent"
                  : "border-line-strong hover:scale-105"
              }`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </Group>

      <div className="border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
        Beden, fiyat ve stok filtreleri, bu veriler firmadan alındığında
        devreye girecek.
      </div>
    </div>
  );

  return (
    <div className="u-wrap grid gap-10 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Masaüstü filtre sütunu */}
      <aside className="hidden lg:block">
        <div className="sticky top-[86px] border border-line bg-bg p-5">{filters}</div>
      </aside>

      <div>
        <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
          <input
            type="search"
            value={f.q ?? ""}
            onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))}
            placeholder="Ürün, kategori, kumaş veya renk ara…"
            aria-label="Ürün ara"
            className="h-11 min-w-[200px] flex-1 border border-line-strong px-3 text-[15px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="u-btn u-btn-ghost h-11 lg:hidden"
          >
            Filtrele{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
          <span className="text-[14px] tabular-nums text-muted">
            <strong className="font-semibold text-ink">{results.length}</strong> ürün
          </span>
        </div>

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setF((prev) => ({ ...prev, [c.key]: undefined }))}
                className="inline-flex items-center gap-2 border border-accent/40 bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-accent transition-colors hover:border-accent"
              >
                {c.label}
                <span aria-hidden className="text-[15px] leading-none">
                  ×
                </span>
                <span className="sr-only">filtresini kaldır</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setF({})}
              className="text-[13px] text-muted underline underline-offset-2 hover:text-ink"
            >
              hepsini temizle
            </button>
          </div>
        )}

        {results.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-20">
            <p className="text-[17px] font-semibold">Bu filtrelerle ürün bulunamadı.</p>
            <p className="max-w-[46ch] text-[15px] text-ink-2">
              Filtreleri gevşetin ya da doğrudan bize sorun — katalogda görünmeyen
              modellerimiz de olabilir.
            </p>
            <button
              type="button"
              onClick={() => setF({})}
              className="u-btn u-btn-ghost mt-2"
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* Mobil filtre çekmecesi */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-bg p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Filtreler</h2>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="h-9 px-3 text-2xl leading-none"
                aria-label="Filtreleri kapat"
              >
                ×
              </button>
            </div>
            {filters}
            <div className="sticky bottom-0 mt-6 flex gap-3 bg-bg pt-4">
              <button
                type="button"
                onClick={() => setF({})}
                className="u-btn u-btn-ghost flex-1"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="u-btn u-btn-primary flex-1"
              >
                {results.length} ürünü gör
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="u-eyebrow">{title}</h3>
      <div className="mt-3 flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Check({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-2 text-left text-[14px] transition-colors ${
        on ? "font-semibold text-accent" : "text-ink-2 hover:text-ink"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          on ? "border-accent bg-accent text-white" : "border-line-strong"
        }`}
      >
        {on && <span className="text-[10px] leading-none">✓</span>}
      </span>
      {children}
    </button>
  );
}
