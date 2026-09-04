import type { Metadata } from "next";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { sessions, userPermissions, users } from "@/db/schema";
import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { ROLE_PERMISSIONS, STAFF_ROLES, type Role } from "@/lib/auth/rbac";
import { TeamManager, type StaffMember } from "./TeamManager";

export const metadata: Metadata = { title: "Ekip ve yetkiler" };

export default async function TeamPage() {
  await requirePermission("staff.read");
  const me = (await getCurrentUser())!;

  const activeSessions = sql<number>`(
    SELECT COUNT(*) FROM ${sessions}
    WHERE ${sessions.userId} = ${users.id} AND ${sessions.expiresAt} > ${Date.now()}
  )`;

  const rows = db
    .select({
      id: users.id,
      name: users.name,
      surname: users.surname,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      activeSessions,
    })
    .from(users)
    .where(
      and(inArray(users.role, [...STAFF_ROLES]), isNull(users.deletedAt)),
    )
    .orderBy(asc(users.name))
    .all();

  // Tum istisnalar tek sorguda; kullanici basina sorgu yapilmaz.
  const overrideRows =
    rows.length > 0
      ? db
          .select({
            userId: userPermissions.userId,
            permission: userPermissions.permission,
            allow: userPermissions.allow,
          })
          .from(userPermissions)
          .where(
            inArray(
              userPermissions.userId,
              rows.map((r) => r.id),
            ),
          )
          .all()
      : [];

  const members: StaffMember[] = rows.map((r) => {
    const mine = overrideRows.filter((o) => o.userId === r.id);
    const base = new Set<string>(ROLE_PERMISSIONS[r.role as Role] ?? []);
    for (const o of mine) {
      if (o.allow) base.add(o.permission);
      else base.delete(o.permission);
    }
    return {
      ...r,
      effective: [...base],
      overrides: mine.map((o) => ({ permission: o.permission, allow: o.allow })),
    };
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[26px] font-bold uppercase">Ekip ve yetkiler</h1>
      <p className="mb-6 max-w-[75ch] text-[13px] text-ink-2">
        Panele girebilen hesaplar burada yönetilir. Rol bir varsayılan izin kümesi
        verir; kişiye özel istisnalar bunun üzerine biner. İzinler her istekte
        sunucuda doğrulanır — arayüzde bir düğmenin görünmemesi tek başına koruma
        değildir.
      </p>

      <TeamManager
        members={members}
        currentUserId={me.id}
        canManage={me.permissions.has("staff.manage")}
        isSuperAdmin={me.role === "super_admin"}
      />
    </div>
  );
}
