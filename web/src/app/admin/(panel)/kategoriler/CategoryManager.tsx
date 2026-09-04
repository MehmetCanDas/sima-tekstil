"use client";

import { useState } from "react";

import {
  archiveCategoryAction,
  reorderCategoriesAction,
  saveCategoryAction,
} from "@/lib/admin/categories.actions";
import { ActionForm, ConfirmSubmit, Field, SubmitButton } from "@/components/admin/ui";
import { Badge } from "@/components/admin/Badge";

/* ---------------------------------------------------------------------------
 * Kategori agaci.
 *
 * Duzenleme satirin altinda acilan bir formda yapilir; ayri sayfaya gitmek
 * agacin baglamini kaybettirir. Silme yerine arsivleme kullanilir ve icinde
 * urun varken engellenir (kural sunucuda, burada yalnizca mesaj gosterilir).
 * ------------------------------------------------------------------------ */

export type CategoryRowData = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  world: string;
  description: string | null;
  image: string | null;
  sortOrder: number;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  productCount: number;
};

export type CategoryNode = CategoryRowData & { children: CategoryRowData[] };

type Parent = { id: string; name: string };

export function CategoryManager({
  tree,
  orphans,
  allParents,
  canCreate,
  canUpdate,
  canDelete,
}: {
  tree: CategoryNode[];
  orphans: CategoryRowData[];
  allParents: Parent[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<string[]>(tree.map((t) => t.id));
  const [orderDirty, setOrderDirty] = useState(false);

  const ordered = [...tree].sort(
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {canCreate ? (
          <button
            type="button"
            className="a-btn a-btn-primary"
            onClick={() => {
              setCreating((v) => !v);
              setEditing(null);
            }}
          >
            {creating ? "Formu kapat" : "Yeni kategori"}
          </button>
        ) : null}

        {orderDirty && canUpdate ? (
          <ActionForm
            action={reorderCategoriesAction}
            onSuccess={() => setOrderDirty(false)}
            className="flex items-center gap-2"
          >
            {() => (
              <>
                {order.map((id) => (
                  <input key={id} type="hidden" name="categoryId" value={id} />
                ))}
                <span className="text-[12px] text-warn">Sıralama kaydedilmedi</span>
                <SubmitButton className="a-btn a-btn-primary a-btn-sm">
                  Sırayı kaydet
                </SubmitButton>
              </>
            )}
          </ActionForm>
        ) : null}
      </div>

      {creating ? (
        <div className="a-card p-5">
          <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Yeni kategori
          </h2>
          <CategoryForm
            parents={allParents}
            onDone={() => setCreating(false)}
            submitLabel="Oluştur"
          />
        </div>
      ) : null}

      <div className="a-card">
        {ordered.length === 0 && orphans.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-muted">
            Henüz kategori yok.
          </p>
        ) : null}

        <ul>
          {ordered.map((node, i) => (
            <li key={node.id} className="border-b border-line last:border-b-0">
              <Row
                row={node}
                depth={0}
                canUpdate={canUpdate}
                canDelete={canDelete}
                editing={editing === node.id}
                onEdit={() => setEditing(editing === node.id ? null : node.id)}
                onMoveUp={i > 0 ? () => move(node.id, -1) : undefined}
                onMoveDown={i < ordered.length - 1 ? () => move(node.id, 1) : undefined}
                parents={allParents}
                onDone={() => setEditing(null)}
              />
              {node.children.length > 0 ? (
                <ul className="border-t border-line bg-surface">
                  {node.children.map((child) => (
                    <li key={child.id} className="border-b border-line last:border-b-0">
                      <Row
                        row={child}
                        depth={1}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        editing={editing === child.id}
                        onEdit={() => setEditing(editing === child.id ? null : child.id)}
                        parents={allParents}
                        onDone={() => setEditing(null)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>

        {orphans.length > 0 ? (
          <div className="border-t-2 border-warn">
            <p className="bg-surface px-4 py-2 text-[12px] text-warn">
              Üst kategorisi arşivde olan kayıtlar
            </p>
            <ul>
              {orphans.map((row) => (
                <li key={row.id} className="border-b border-line last:border-b-0">
                  <Row
                    row={row}
                    depth={1}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    editing={editing === row.id}
                    onEdit={() => setEditing(editing === row.id ? null : row.id)}
                    parents={allParents}
                    onDone={() => setEditing(null)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  row,
  depth,
  canUpdate,
  canDelete,
  editing,
  onEdit,
  onMoveUp,
  onMoveDown,
  parents,
  onDone,
}: {
  row: CategoryRowData;
  depth: number;
  canUpdate: boolean;
  canDelete: boolean;
  editing: boolean;
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  parents: Parent[];
  onDone: () => void;
}) {
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3"
        style={{ paddingLeft: 16 + depth * 24 }}
      >
        {row.image ? (
          // Kategori gorseli serbest URL olabildigi icin next/image yerine img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.image}
            alt=""
            className="h-9 w-9 border border-line object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{row.name}</span>
            {row.status !== "active" ? (
              <Badge tone={row.status === "archived" ? "mute" : "warn"}>
                {row.status === "archived" ? "Arşiv" : "Gizli"}
              </Badge>
            ) : null}
            <span className="text-[12px] text-muted">/{row.slug}</span>
          </div>
          <p className="text-[12px] text-muted">
            {row.world === "promosyon" ? "Promosyon" : "İş Kıyafetleri"} ·{" "}
            {row.productCount} ürün
          </p>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp ? (
            <button
              type="button"
              className="a-btn a-btn-ghost a-btn-sm"
              onClick={onMoveUp}
              aria-label={`${row.name} yukarı taşı`}
            >
              ↑
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              type="button"
              className="a-btn a-btn-ghost a-btn-sm"
              onClick={onMoveDown}
              aria-label={`${row.name} aşağı taşı`}
            >
              ↓
            </button>
          ) : null}
          {canUpdate ? (
            <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={onEdit}>
              {editing ? "Kapat" : "Düzenle"}
            </button>
          ) : null}
          {canDelete ? (
            <ActionForm action={archiveCategoryAction}>
              {() => (
                <>
                  <input type="hidden" name="id" value={row.id} />
                  {row.status === "archived" ? (
                    <>
                      <input type="hidden" name="restore" value="1" />
                      <SubmitButton className="a-btn a-btn-ghost a-btn-sm" pendingText="…">
                        Geri al
                      </SubmitButton>
                    </>
                  ) : (
                    <ConfirmSubmit
                      className="a-btn a-btn-danger a-btn-sm"
                      title={`"${row.name}" arşive alınsın mı?`}
                      body="Kategori silinmez, arşive alınır. İçinde ürün varsa işlem reddedilir."
                      confirmLabel="Arşive al"
                    >
                      Arşive al
                    </ConfirmSubmit>
                  )}
                </>
              )}
            </ActionForm>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="border-t border-line bg-surface p-5">
          <CategoryForm row={row} parents={parents} onDone={onDone} submitLabel="Kaydet" />
        </div>
      ) : null}
    </>
  );
}

function CategoryForm({
  row,
  parents,
  onDone,
  submitLabel,
}: {
  row?: CategoryRowData;
  parents: Parent[];
  onDone: () => void;
  submitLabel: string;
}) {
  return (
    <ActionForm action={saveCategoryAction} onSuccess={onDone} className="flex flex-col gap-4">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            {row ? <input type="hidden" name="id" value={row.id} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Kategori adı" name="name" required error={err("name")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={row?.name ?? ""} required />
                )}
              </Field>
              <Field
                label="URL slug"
                name="slug"
                error={err("slug")}
                hint="Boş bırakılırsa addan üretilir."
              >
                {(p) => <input {...p} className="a-input" defaultValue={row?.slug ?? ""} />}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Üst kategori" name="parentId" error={err("parentId")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={row?.parentId ?? ""}>
                    <option value="">— ana kategori —</option>
                    {parents
                      .filter((x) => x.id !== row?.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                )}
              </Field>
              <Field label="Dünya" name="world" error={err("world")}>
                {(p) => (
                  <select
                    {...p}
                    className="a-select"
                    defaultValue={row?.world ?? "is-kiyafetleri"}
                  >
                    <option value="is-kiyafetleri">İş Kıyafetleri</option>
                    <option value="promosyon">Promosyon</option>
                  </select>
                )}
              </Field>
              <Field label="Durum" name="status" error={err("status")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={row?.status ?? "active"}>
                    <option value="active">Yayında</option>
                    <option value="hidden">Gizli</option>
                    <option value="archived">Arşiv</option>
                  </select>
                )}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Kategori görseli"
                name="image"
                error={err("image")}
                hint="Görsel yolu, örn. /catalog/p02-polar-mont/00.jpeg"
              >
                {(p) => <input {...p} className="a-input" defaultValue={row?.image ?? ""} />}
              </Field>
              <Field label="Sıra" name="sortOrder" error={err("sortOrder")}>
                {(p) => (
                  <input
                    {...p}
                    className="a-input"
                    type="number"
                    defaultValue={row?.sortOrder ?? 0}
                  />
                )}
              </Field>
            </div>

            <Field label="Açıklama" name="description" error={err("description")}>
              {(p) => (
                <textarea
                  {...p}
                  className="a-textarea"
                  rows={2}
                  defaultValue={row?.description ?? ""}
                />
              )}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="SEO başlığı" name="seoTitle" error={err("seoTitle")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={row?.seoTitle ?? ""} />
                )}
              </Field>
              <Field label="SEO açıklaması" name="seoDescription" error={err("seoDescription")}>
                {(p) => (
                  <input
                    {...p}
                    className="a-input"
                    defaultValue={row?.seoDescription ?? ""}
                  />
                )}
              </Field>
            </div>

            <div className="flex gap-2">
              <SubmitButton>{submitLabel}</SubmitButton>
              <button type="button" className="a-btn a-btn-ghost" onClick={onDone}>
                Vazgeç
              </button>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
