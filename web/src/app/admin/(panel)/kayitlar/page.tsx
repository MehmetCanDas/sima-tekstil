import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { activityLog, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { dateTime } from "@/lib/admin/format";
import { Pagination, pageFrom } from "@/components/admin/Pagination";
import { TableToolbar } from "@/components/admin/TableToolbar";
import { EmptyState } from "@/components/admin/ui";

export const metadata: Metadata = { title: "İşlem kayıtları" };

const PAGE_SIZE = 40;

/* ---------------------------------------------------------------------------
 * Denetim kaydi (spec: 18).
 *
 * Kayitlar yalnizca okunur; panelden silinemez veya duzenlenemez. Degisen
 * alanlar "onceki -> sonraki" olarak gosterilir.
 * ------------------------------------------------------------------------ */

const ACTION_LABEL: Record<string, string> = {
  "product.create": "Ürün oluşturdu",
  "product.update": "Ürünü güncelledi",
  "product.archive": "Ürünü arşivledi",
  "product.restore": "Ürünü arşivden çıkardı",
  "product.options": "Renk/beden seçeneklerini değiştirdi",
  "product.variants_generate": "Varyant üretti",
  "product.variants_update": "Varyantları güncelledi",
  "product.variant_delete": "Varyant kaldırdı",
  "product.image_upload": "Görsel yükledi",
  "product.image_delete": "Görsel sildi",
  "category.create": "Kategori oluşturdu",
  "category.update": "Kategoriyi güncelledi",
  "category.archive": "Kategoriyi arşivledi",
  "category.restore": "Kategoriyi geri aldı",
  "customer.create": "Hesap oluşturdu",
  "customer.update": "Hesabı güncelledi",
  "customer.active": "Hesabı onayladı",
  "customer.suspended": "Hesabı askıya aldı",
  "customer.rejected": "Başvuruyu reddetti",
  "customer.delete": "Hesabı arşivledi",
  "customer.restore": "Hesabı geri aldı",
  "customer.price_set": "Özel fiyat tanımladı",
  "customer.price_delete": "Özel fiyatı kaldırdı",
  "company.create": "Firma oluşturdu",
  "company.update": "Firmayı güncelledi",
  "company.archive": "Firmayı arşivledi",
  "quote.update": "Teklifi güncelledi",
  "quote.convert": "Teklifi siparişe çevirdi",
  "quote.archive": "Teklifi arşivledi",
  "order.update": "Siparişi güncelledi",
  "order.status_change": "Sipariş durumunu değiştirdi",
  "order.archive": "Siparişi arşivledi",
  "staff.create": "Ekip üyesi ekledi",
  "staff.update": "Ekip üyesini güncelledi",
  "staff.permissions": "İzinleri değiştirdi",
  "staff.revoke_sessions": "Oturumları kapattı",
  "settings.update": "Ayarları değiştirdi",
};

const ENTITY_PATH: Record<string, string> = {
  product: "/admin/urunler",
  category: "/admin/kategoriler",
  user: "/admin/musteriler",
  company: "/admin/firmalar",
  quote: "/admin/teklifler",
  order: "/admin/siparisler",
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("log.read");
  const params = await searchParams;
  const page = pageFrom(params.page);

  const parts: (SQL | undefined)[] = [];
  if (params.entity) parts.push(eq(activityLog.entityType, params.entity));
  if (params.actor) parts.push(eq(activityLog.actorId, params.actor));
  if (params.action) parts.push(like(activityLog.action, `${params.action}%`));
  const term = params.q?.trim();
  if (term) {
    const pattern = `%${term.toLocaleLowerCase("tr")}%`;
    parts.push(
      or(
        like(sql`lower(${activityLog.entityLabel})`, pattern),
        like(sql`lower(${activityLog.actorName})`, pattern),
        like(sql`lower(${activityLog.action})`, pattern),
      ),
    );
  }
  const where = parts.length > 0 ? and(...parts.filter(Boolean)) : undefined;

  const total = db.select({ n: count() }).from(activityLog).where(where).get()?.n ?? 0;

  const rows = db
    .select()
    .from(activityLog)
    .where(where)
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  const actors = db
    .selectDistinct({ id: activityLog.actorId, name: activityLog.actorName })
    .from(activityLog)
    .orderBy(asc(activityLog.actorName))
    .all()
    .filter((a): a is { id: string; name: string } => Boolean(a.id && a.name));

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="text-[26px] font-bold uppercase">İşlem kayıtları</h1>
      <p className="mb-5 max-w-[75ch] text-[13px] text-ink-2">
        Panelde yapılan kritik işlemler burada tutulur. Kayıtlar silinemez ve
        düzenlenemez — kim, ne zaman, neyi değiştirdi sorusunun cevabıdır.
      </p>

      <div className="a-card">
        <TableToolbar
          searchPlaceholder="Kayıt adı, kişi veya işlem ara…"
          filters={[
            {
              name: "entity",
              label: "Kayıt türü",
              options: [
                { value: "product", label: "Ürün" },
                { value: "category", label: "Kategori" },
                { value: "user", label: "Kullanıcı" },
                { value: "company", label: "Firma" },
                { value: "quote", label: "Teklif" },
                { value: "order", label: "Sipariş" },
              ],
            },
            {
              name: "actor",
              label: "Kişi",
              options: actors.map((a) => ({ value: a.id, label: a.name })),
            },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            title="Kayıt yok"
            body="Panelde bir değişiklik yapıldığında burada görünür."
          />
        ) : (
          <ul>
            {rows.map((row) => {
              const path = row.entityType ? ENTITY_PATH[row.entityType] : null;
              return (
                <li key={row.id} className="border-b border-line px-4 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
                    <strong>{row.actorName ?? "—"}</strong>
                    <span>{ACTION_LABEL[row.action] ?? row.action}</span>
                    {row.entityLabel ? (
                      path && row.entityId ? (
                        <Link
                          href={`${path}/${row.entityId}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {row.entityLabel}
                        </Link>
                      ) : (
                        <span className="font-semibold">{row.entityLabel}</span>
                      )
                    ) : null}
                    <span className="ml-auto whitespace-nowrap text-[11px] text-muted">
                      {dateTime(row.createdAt)}
                      {row.ip ? ` · ${row.ip}` : ""}
                    </span>
                  </div>
                  <Changes before={row.before} after={row.after} />
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={params}
          basePath="/admin/kayitlar"
        />
      </div>
    </div>
  );
}

/** "fiyat 100 → 120" satirlarini uretir. */
function Changes({ before, after }: { before: string | null; after: string | null }) {
  const b = parse(before);
  const a = parse(after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (keys.length === 0) return null;

  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-0.5 text-[12px] text-muted">
      {keys.slice(0, 12).map((key) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <dt className="font-mono">{key}</dt>
          <dd>
            {key in b ? (
              <>
                <span className="line-through">{show(b[key])}</span>
                <span className="mx-1">→</span>
              </>
            ) : null}
            <span className="font-semibold text-ink">{show(a[key])}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function parse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "evet" : "hayır";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
