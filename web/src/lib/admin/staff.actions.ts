"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { userPermissions, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth/dal";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { destroyAllSessionsFor } from "@/lib/auth/session";
import {
  ROLE_PERMISSIONS,
  isPermission,
  type Permission,
  type Role,
} from "@/lib/auth/rbac";
import { type ActionResult, fail, fieldErrorsOf, guard, ok } from "./action";
import { logActivity } from "./log";

/* ---------------------------------------------------------------------------
 * Ekip ve granular yetki yonetimi (spec: 10, 19).
 *
 * Roller varsayilan izin kumesini verir. Kullanici bazli istisnalar
 * user_permissions tablosunda tutulur: rolde olmayan bir izni acmak (allow=1)
 * ya da rolden gelen bir izni kapatmak (allow=0).
 * ------------------------------------------------------------------------ */

const staffSchema = z.object({
  id: z.string().optional(),
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta girin.")),
  name: z.string().trim().min(1, "Ad gerekli.").max(120),
  surname: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(["sales_manager", "admin", "super_admin"]),
  status: z.enum(["active", "suspended"]),
  password: z.string().optional(),
});

export async function saveStaffAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("staff.manage");
    const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return fail("Form eksik veya hatalı.", fieldErrorsOf(parsed.error));

    const input = parsed.data;
    const isNew = !input.id;

    // Super admin yalnizca super admin tarafindan atanabilir; yetki yukseltmeyi
    // engelleyen tek kontrol budur.
    if (input.role === "super_admin" && actor.role !== "super_admin") {
      return fail("Süper admin rolünü yalnızca bir süper admin atayabilir.", {
        role: "Bu rolü atama yetkiniz yok.",
      });
    }

    const row = {
      email: input.email,
      name: input.name,
      surname: input.surname ?? "",
      phone: input.phone || null,
      role: input.role,
      status: input.status,
      companyId: null,
      updatedAt: Date.now(),
    };

    if (isNew) {
      const problem = validatePassword(input.password ?? "");
      if (problem) return fail(problem, { password: problem });

      const id = randomUUID();
      db.insert(users)
        .values({
          id,
          passwordHash: await hashPassword(input.password!),
          approvedAt: Date.now(),
          approvedBy: actor.id,
          ...row,
        })
        .run();

      await logActivity({
        actor,
        action: "staff.create",
        entityType: "user",
        entityId: id,
        entityLabel: `${input.name} (${input.email})`,
        after: { role: input.role, status: input.status },
      });

      revalidatePath("/admin/ekip");
      return ok(undefined, "Ekip üyesi oluşturuldu.");
    }

    const id = input.id!;
    const before = db.select().from(users).where(eq(users.id, id)).get();
    if (!before) return fail("Kullanıcı bulunamadı.");
    if (before.role === "super_admin" && actor.role !== "super_admin") {
      return fail("Süper admin hesabını yalnızca bir süper admin düzenleyebilir.");
    }
    if (before.id === actor.id && input.role !== before.role) {
      return fail("Kendi rolünüzü değiştiremezsiniz.");
    }
    if (before.id === actor.id && input.status !== "active") {
      return fail("Kendi hesabınızı askıya alamazsınız.");
    }

    db.update(users).set(row).where(eq(users.id, id)).run();

    if (input.password && input.password.length > 0) {
      const problem = validatePassword(input.password);
      if (problem) return fail(problem, { password: problem });
      db.update(users)
        .set({ passwordHash: await hashPassword(input.password) })
        .where(eq(users.id, id))
        .run();
      destroyAllSessionsFor(id);
    }

    if (input.status !== "active") destroyAllSessionsFor(id);

    await logActivity({
      actor,
      action: "staff.update",
      entityType: "user",
      entityId: id,
      entityLabel: `${input.name} (${input.email})`,
      before: { role: before.role, status: before.status },
      after: { role: input.role, status: input.status },
    });

    revalidatePath("/admin/ekip");
    return ok(undefined, "Ekip üyesi güncellendi.");
  });
}

/**
 * Bir kullanicinin izin istisnalarini toptan kaydeder.
 * Rolun varsayilaniyla ayni olan secimler tabloya yazilmaz; boylece rol
 * tanimi degistiginde istisna birakilmamis kullanicilar otomatik uyum saglar.
 */
export async function savePermissionsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("staff.manage");
    const userId = String(formData.get("userId") ?? "");
    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) return fail("Kullanıcı bulunamadı.");

    if (target.role === "super_admin") {
      return fail("Süper admin tüm izinlere sahiptir; istisna tanımlanamaz.");
    }
    if (target.id === actor.id) {
      return fail("Kendi izinlerinizi değiştiremezsiniz.");
    }

    const checked = new Set(
      formData.getAll("permission").map(String).filter(isPermission),
    );
    const base = new Set<Permission>(ROLE_PERMISSIONS[target.role as Role] ?? []);
    const all = new Set<Permission>([...base, ...checked]);

    const overrides: { permission: Permission; allow: boolean }[] = [];
    for (const permission of all) {
      const wanted = checked.has(permission);
      const fromRole = base.has(permission);
      if (wanted !== fromRole) overrides.push({ permission, allow: wanted });
    }

    db.transaction((tx) => {
      tx.delete(userPermissions).where(eq(userPermissions.userId, userId)).run();
      for (const o of overrides) {
        tx.insert(userPermissions)
          .values({ userId, permission: o.permission, allow: o.allow })
          .run();
      }
    });

    await logActivity({
      actor,
      action: "staff.permissions",
      entityType: "user",
      entityId: userId,
      entityLabel: `${target.name} ${target.surname}`.trim(),
      after: { overrides },
    });

    revalidatePath("/admin/ekip");
    return ok(
      undefined,
      overrides.length === 0
        ? "İzinler rol varsayılanına döndürüldü."
        : `${overrides.length} izin istisnası kaydedildi.`,
    );
  });
}

/** Bir kullanicinin tum oturumlarini kapatir. */
export async function revokeSessionsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const actor = await requirePermission("staff.manage");
    const userId = String(formData.get("userId") ?? "");
    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) return fail("Kullanıcı bulunamadı.");

    destroyAllSessionsFor(userId);

    await logActivity({
      actor,
      action: "staff.revoke_sessions",
      entityType: "user",
      entityId: userId,
      entityLabel: `${target.name} ${target.surname}`.trim(),
    });

    revalidatePath("/admin/ekip");
    return ok(undefined, "Açık oturumlar kapatıldı.");
  });
}
