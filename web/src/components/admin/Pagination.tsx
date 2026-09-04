import Link from "next/link";

/* ---------------------------------------------------------------------------
 * Sayfalama. Sunucuda render edilir; toplam sayi COUNT sorgusundan gelir.
 * Sayfa numaralari yerine pencere gosterilir - 100.000 urunde numara listesi
 * kullanilamaz hale gelir.
 * ------------------------------------------------------------------------ */

export function Pagination({
  page,
  pageSize,
  total,
  params,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") next.set(k, v);
    }
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-4 py-3 text-[13px]"
      aria-label="Sayfalama"
    >
      <p className="text-muted">
        <strong className="font-semibold text-ink">
          {from.toLocaleString("tr")}–{to.toLocaleString("tr")}
        </strong>{" "}
        / {total.toLocaleString("tr")} kayıt
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={href(1)} disabled={page === 1} label="İlk" />
        <PageLink href={href(page - 1)} disabled={page === 1} label="Önceki" />
        <span className="px-3 text-muted">
          {page} / {pages}
        </span>
        <PageLink href={href(page + 1)} disabled={page >= pages} label="Sonraki" />
        <PageLink href={href(pages)} disabled={page >= pages} label="Son" />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="a-btn a-btn-ghost a-btn-sm pointer-events-none opacity-40">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className="a-btn a-btn-ghost a-btn-sm">
      {label}
    </Link>
  );
}

/** searchParams'tan guvenli sayfa numarasi. */
export function pageFrom(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
