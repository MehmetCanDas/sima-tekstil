"use client";

import { useState } from "react";

import {
  revokeSessionsAction,
  savePermissionsAction,
  saveStaffAction,
} from "@/lib/admin/staff.actions";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_LABEL,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  type Permission,
  type Role,
} from "@/lib/auth/rbac";
import { ACCOUNT_STATUS, dateTime, relative } from "@/lib/admin/format";
import { Badge, StatusBadge } from "@/components/admin/Badge";
import { ActionForm, ConfirmSubmit, Field, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Ekip listesi ve izin matrisi (spec: 10, 19).
 *
 * Izin kutulari rol varsayilaniyla baslar; isaretleri degistirmek istisna
 * uretir. Rol varsayilanindan farkli olanlar gorsel olarak isaretlenir ki
 * "bu kisi neden farkli" sorusu tek bakista cevaplansin.
 * ------------------------------------------------------------------------ */

export type StaffMember = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  lastLoginAt: number | null;
  createdAt: number;
  activeSessions: number;
  effective: string[];
  overrides: { permission: string; allow: boolean }[];
};

export function TeamManager({
  members,
  currentUserId,
  canManage,
  isSuperAdmin,
}: {
  members: StaffMember[];
  currentUserId: string;
  canManage: boolean;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <div>
          <button
            type="button"
            className="a-btn a-btn-primary"
            onClick={() => {
              setCreating((v) => !v);
              setOpen(null);
            }}
          >
            {creating ? "Formu kapat" : "Ekip üyesi ekle"}
          </button>
        </div>
      ) : null}

      {creating ? (
        <div className="a-card p-5">
          <h2 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Yeni ekip üyesi
          </h2>
          <StaffForm
            isSuperAdmin={isSuperAdmin}
            submitLabel="Oluştur"
            onDone={() => setCreating(false)}
          />
        </div>
      ) : null}

      <div className="a-card">
        <table className="a-table">
          <thead>
            <tr>
              <th>Kişi</th>
              <th>Rol</th>
              <th>Durum</th>
              <th className="text-right">Açık oturum</th>
              <th className="text-right">Son giriş</th>
              <th className="text-right">İzinler</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className="font-semibold">
                    {`${m.name} ${m.surname}`.trim()}
                    {m.id === currentUserId ? (
                      <span className="ml-2 text-[11px] text-muted">(siz)</span>
                    ) : null}
                  </span>
                  <div className="text-[12px] text-muted">{m.email}</div>
                </td>
                <td className="text-[12px]">
                  {ROLE_LABEL[m.role as Role] ?? m.role}
                  {m.overrides.length > 0 ? (
                    <div className="mt-0.5">
                      <Badge tone="warn">{m.overrides.length} istisna</Badge>
                    </div>
                  ) : null}
                </td>
                <td>
                  <StatusBadge map={ACCOUNT_STATUS} value={m.status} />
                </td>
                <td className="text-right tabular-nums">{m.activeSessions}</td>
                <td className="whitespace-nowrap text-right text-[12px] text-muted">
                  {relative(m.lastLoginAt)}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="a-btn a-btn-ghost a-btn-sm"
                    onClick={() => setOpen(open === m.id ? null : m.id)}
                  >
                    {open === m.id ? "Kapat" : "Yönet"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {open ? (
          <MemberPanel
            member={members.find((m) => m.id === open)!}
            canManage={canManage}
            isSelf={open === currentUserId}
            isSuperAdmin={isSuperAdmin}
            onDone={() => setOpen(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function MemberPanel({
  member,
  canManage,
  isSelf,
  isSuperAdmin,
  onDone,
}: {
  member: StaffMember;
  canManage: boolean;
  isSelf: boolean;
  isSuperAdmin: boolean;
  onDone: () => void;
}) {
  const base = new Set<string>(ROLE_PERMISSIONS[member.role as Role] ?? []);
  const effective = new Set(member.effective);

  return (
    <div className="border-t-2 border-accent bg-surface p-5">
      <h3 className="text-[16px] font-semibold uppercase">
        {`${member.name} ${member.surname}`.trim()}
      </h3>
      <p className="mb-4 text-[12px] text-muted">
        Hesap açılışı {dateTime(member.createdAt)} · {member.email}
      </p>

      {canManage ? (
        <div className="a-card mb-5 p-5">
          <h4 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Hesap bilgileri
          </h4>
          <StaffForm
            member={member}
            isSuperAdmin={isSuperAdmin}
            submitLabel="Kaydet"
            onDone={onDone}
          />

          {member.activeSessions > 0 ? (
            <div className="mt-5 border-t border-line pt-4">
              <ActionForm action={revokeSessionsAction}>
                {() => (
                  <>
                    <input type="hidden" name="userId" value={member.id} />
                    <ConfirmSubmit
                      className="a-btn a-btn-danger a-btn-sm"
                      title="Oturumlar kapatılsın mı?"
                      body={`${member.activeSessions} açık oturum sonlandırılır. Kullanıcı yeniden giriş yapmak zorunda kalır.`}
                      confirmLabel="Oturumları kapat"
                    >
                      Açık oturumları kapat ({member.activeSessions})
                    </ConfirmSubmit>
                  </>
                )}
              </ActionForm>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="a-card p-5">
        <h4 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">
          İzinler
        </h4>
        <p className="mb-4 text-[12px] text-muted">
          Turuncu çerçeveli kutular rol varsayılanından farklıdır.
          {member.role === "super_admin"
            ? " Süper admin tüm izinlere sahiptir ve değiştirilemez."
            : ""}
        </p>

        <ActionForm action={savePermissionsAction} onSuccess={onDone}>
          {(state) => (
            <>
              <input type="hidden" name="userId" value={member.id} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PERMISSION_GROUPS.map((group) => {
                  const items = PERMISSIONS.filter((p) => p.startsWith(group.prefix));
                  if (items.length === 0) return null;
                  return (
                    <fieldset
                      key={group.prefix}
                      disabled={!canManage || isSelf || member.role === "super_admin"}
                    >
                      <legend className="a-label">{group.title}</legend>
                      <div className="flex flex-col gap-1">
                        {items.map((permission) => (
                          <PermissionBox
                            key={permission}
                            permission={permission}
                            checked={effective.has(permission)}
                            fromRole={base.has(permission)}
                          />
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              {canManage && !isSelf && member.role !== "super_admin" ? (
                <div className="mt-5 flex items-center gap-3">
                  <SubmitButton>İzinleri kaydet</SubmitButton>
                  {state && !state.ok ? (
                    <span className="text-[13px] text-[#b3261e]">{state.error}</span>
                  ) : null}
                </div>
              ) : null}
              {isSelf ? (
                <p className="mt-4 text-[13px] text-muted">
                  Kendi izinlerinizi değiştiremezsiniz.
                </p>
              ) : null}
            </>
          )}
        </ActionForm>
      </div>
    </div>
  );
}

function PermissionBox({
  permission,
  checked,
  fromRole,
}: {
  permission: Permission;
  checked: boolean;
  fromRole: boolean;
}) {
  const [on, setOn] = useState(checked);
  const differs = on !== fromRole;

  return (
    <label
      className={`flex items-center gap-2 border px-2 py-1 text-[12.5px] ${
        differs ? "border-accent bg-accent-soft" : "border-transparent"
      }`}
    >
      <input
        type="checkbox"
        name="permission"
        value={permission}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span className="font-mono">{permission}</span>
    </label>
  );
}

function StaffForm({
  member,
  isSuperAdmin,
  submitLabel,
  onDone,
}: {
  member?: StaffMember;
  isSuperAdmin: boolean;
  submitLabel: string;
  onDone: () => void;
}) {
  const roles = STAFF_ROLES.filter((r) => isSuperAdmin || r !== "super_admin");

  return (
    <ActionForm action={saveStaffAction} onSuccess={onDone} className="flex flex-col gap-4">
      {(state) => {
        const err = (f: string) => (state && !state.ok ? state.fieldErrors?.[f] : undefined);
        return (
          <>
            {member ? <input type="hidden" name="id" value={member.id} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ad" name="name" required error={err("name")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={member?.name ?? ""} required />
                )}
              </Field>
              <Field label="Soyad" name="surname" error={err("surname")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={member?.surname ?? ""} />
                )}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-posta" name="email" required error={err("email")}>
                {(p) => (
                  <input
                    {...p}
                    type="email"
                    className="a-input"
                    defaultValue={member?.email ?? ""}
                    autoComplete="off"
                    required
                  />
                )}
              </Field>
              <Field label="Telefon" name="phone" error={err("phone")}>
                {(p) => (
                  <input {...p} className="a-input" defaultValue={member?.phone ?? ""} />
                )}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Rol" name="role" error={err("role")}>
                {(p) => (
                  <select
                    {...p}
                    className="a-select"
                    defaultValue={member?.role ?? "sales_manager"}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Durum" name="status" error={err("status")}>
                {(p) => (
                  <select {...p} className="a-select" defaultValue={member?.status ?? "active"}>
                    <option value="active">Aktif</option>
                    <option value="suspended">Askıda</option>
                  </select>
                )}
              </Field>
            </div>

            <Field
              label={member ? "Yeni şifre" : "Şifre"}
              name="password"
              required={!member}
              error={err("password")}
              hint={
                member
                  ? "Boş bırakırsanız değişmez. Değiştirirseniz açık oturumlar kapanır."
                  : "En az 10 karakter, bir harf ve bir rakam."
              }
            >
              {(p) => (
                <input
                  {...p}
                  type="password"
                  className="a-input"
                  autoComplete="new-password"
                  required={!member}
                />
              )}
            </Field>

            <div className="flex items-center gap-3">
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
