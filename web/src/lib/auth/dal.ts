import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { companies, userPermissions, users } from "@/db/schema";
import { readSessionUserId } from "./session";
import {
  type Permission,
  type Role,
  isStaffRole,
  resolvePermissions,
} from "./rbac";

/* ---------------------------------------------------------------------------
 * Data Access Layer.
 *
 * Panelde yetki kontrolu YALNIZCA buradan gecer. Sayfalar ve server action'lar
 * requirePermission() cagirir; frontend'de buton gizlemek kontrol sayilmaz.
 * ------------------------------------------------------------------------ */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  status: string;
  companyId: string | null;
  companyName: string | null;
  permissions: Set<Permission>;
};

/** Istek basina bir kez calisir; ayni render icinde tekrar sorgulanmaz. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const row = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      surname: users.surname,
      role: users.role,
      status: users.status,
      companyId: users.companyId,
      deletedAt: users.deletedAt,
      companyName: companies.name,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, userId))
    .get();

  if (!row || row.deletedAt !== null) return null;
  if (row.status !== "active") return null;

  const overrides = db
    .select({ permission: userPermissions.permission, allow: userPermissions.allow })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .all();

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    surname: row.surname,
    role: row.role as Role,
    status: row.status,
    companyId: row.companyId,
    companyName: row.companyName,
    permissions: resolvePermissions(row.role, overrides),
  };
});

/** Panel kullanicisi degilse giris sayfasina yollar. */
export async function requireStaff(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/admin/giris${next}`);
  }
  return user;
}

/** Yetki hatasi. Server action'larda yakalanip kullaniciya mesaj olarak doner. */
export class PermissionError extends Error {
  constructor(public readonly permission: Permission) {
    super("Bu işlem için yetkiniz yok.");
    this.name = "PermissionError";
  }
}

/**
 * Her yazma isleminin ilk satiri. Oturum yoksa girise yollar, yetki yoksa
 * PermissionError firlatir.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireStaff();
  if (!user.permissions.has(permission)) throw new PermissionError(permission);
  return user;
}

export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.permissions.has(permission) ?? false;
}
