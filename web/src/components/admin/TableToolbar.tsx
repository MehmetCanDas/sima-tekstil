"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/* ---------------------------------------------------------------------------
 * Tablo ust cubugu: arama + filtreler.
 *
 * Durum URL'de tutulur. Boylece filtrelenmis bir liste paylasilabilir,
 * geri tusu calisir ve sunucu sorgusu sayfalama ile ayni kaynaktan beslenir.
 * ------------------------------------------------------------------------ */

export type FilterDef = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

export function TableToolbar({
  searchPlaceholder = "Ara…",
  filters = [],
  children,
}: {
  searchPlaceholder?: string;
  filters?: FilterDef[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL disaridan degisirse (geri tusu, filtre temizleme) kutuyu esitle.
  useEffect(() => {
    setTerm(params.get("q") ?? "");
  }, [params]);

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Filtre degisince ilk sayfaya don; aksi halde bos sayfa gorunur.
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function onSearch(value: string) {
    setTerm(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value.trim() || null }), 300);
  }

  const active = filters.filter((f) => params.get(f.name)).length + (params.get("q") ? 1 : 0);

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-line bg-bg px-4 py-3">
      <div className="min-w-[220px] flex-1">
        <input
          type="search"
          className="a-input"
          placeholder={searchPlaceholder}
          value={term}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={searchPlaceholder}
        />
      </div>

      {filters.map((f) => (
        <select
          key={f.name}
          className="a-select w-auto min-w-[140px]"
          aria-label={f.label}
          value={params.get(f.name) ?? ""}
          onChange={(e) => apply({ [f.name]: e.target.value || null })}
        >
          <option value="">{f.label}: tümü</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {active > 0 ? (
        <button
          type="button"
          className="a-btn a-btn-ghost a-btn-sm"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
        >
          Filtreleri temizle ({active})
        </button>
      ) : null}

      <span
        aria-hidden={!pending}
        className={`text-[12px] text-muted transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
      >
        yükleniyor…
      </span>

      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

/** Sutun basligini siralanabilir baglantiya cevirir. */
export function SortLink({ column, label }: { column: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("sort");
  const dir = params.get("dir") === "desc" ? "desc" : "asc";
  const isActive = current === column;

  function toggle() {
    const next = new URLSearchParams(params.toString());
    next.set("sort", column);
    next.set("dir", isActive && dir === "asc" ? "desc" : "asc");
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1 uppercase tracking-[0.07em] hover:text-ink"
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <span aria-hidden className={isActive ? "text-accent" : "text-line-strong"}>
        {isActive && dir === "desc" ? "▼" : "▲"}
      </span>
    </button>
  );
}
