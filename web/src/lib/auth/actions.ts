"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { type ActionResult, fail, guard } from "@/lib/admin/action";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { isStaffRole } from "./rbac";
import {
  createSession,
  destroyAllSessionsFor,
  destroySession,
  pruneExpiredSessions,
  requestIp,
  touchLogin,
} from "./session";
import { getCurrentUser } from "./dal";

/* ---------------------------------------------------------------------------
 * Panel girisi.
 *
 * Guvenlik notlari:
 *  - Kullanici var/yok ayrimi disariya sizmaz: tum basarisiz denemeler ayni
 *    mesaji doner.
 *  - Kullanici bulunamasa bile bir dogrulama yapilir; boylece yanit suresi
 *    e-posta varliginı ele vermez.
 *  - 5 basarisiz denemeden sonra hesap 15 dakika kilitlenir.
 * ------------------------------------------------------------------------ */

const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "Y2Fubm90LW1hdGNoLWFueXRoaW5nLWV2ZXItYmVjYXVzZS1yYW5kb20tcGFkZGluZy0wMDA=";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta girin.")),
  password: z.string().min(1, "Şifre gerekli."),
  next: z.string().optional(),
});

export async function loginAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next"),
    });
    if (!parsed.success) return fail("E-posta veya şifre hatalı.");

    const { email, password } = parsed.data;
    const user = db.select().from(users).where(eq(users.email, email)).get();
    const now = Date.now();

    if (user?.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil - now) / 60000);
      return fail(`Çok fazla hatalı deneme. ${minutes} dakika sonra tekrar deneyin.`);
    }

    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid || user.deletedAt !== null) {
      if (user) {
        const attempts = user.failedLogins + 1;
        db.update(users)
          .set({
            failedLogins: attempts,
            lockedUntil: attempts >= MAX_ATTEMPTS ? now + LOCK_MS : null,
          })
          .where(eq(users.id, user.id))
          .run();
      }
      return fail("E-posta veya şifre hatalı.");
    }

    if (user.status === "pending") {
      return fail("Hesabınız henüz onaylanmadı.");
    }
    if (user.status !== "active") {
      return fail("Hesabınız aktif değil. Yöneticinizle görüşün.");
    }
    if (!isStaffRole(user.role)) {
      // Musteri hesaplari panele giremez; kendi hesap sayfalarina yonlendirilir.
      return fail("Bu hesabın yönetim paneline erişimi yok.");
    }

    // Sifre eski maliyet parametreleriyle uretilmisse sessizce yenile.
    if (needsRehash(user.passwordHash)) {
      db.update(users)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(users.id, user.id))
        .run();
    }

    pruneExpiredSessions();
    touchLogin(user.id, await requestIp());
    await createSession(user.id);

    // Acik yonlendirme acigini kapatmak icin yalnizca panel ici yollar kabul edilir.
    const raw = parsed.data.next ?? "";
    const target = raw.startsWith("/admin") && !raw.startsWith("//") ? raw : "/admin";
    redirect(target);
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/giris");
}

/** Oturum sahibinin kendi sifresini degistirmesi. */
const passwordSchema = z.object({
  current: z.string().min(1, "Mevcut şifre gerekli."),
  next: z.string(),
});

export async function changeOwnPasswordAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  return guard(async () => {
    const me = await getCurrentUser();
    if (!me) return fail("Oturum bulunamadı.");

    const parsed = passwordSchema.safeParse({
      current: formData.get("current"),
      next: formData.get("next"),
    });
    if (!parsed.success) return fail("Form eksik.");

    const { validatePassword } = await import("./password");
    const problem = validatePassword(parsed.data.next);
    if (problem) return fail(problem, { next: problem });

    const row = db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, me.id))
      .get();
    if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
      return fail("Mevcut şifre hatalı.", { current: "Mevcut şifre hatalı." });
    }

    db.update(users)
      .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: Date.now() })
      .where(eq(users.id, me.id))
      .run();

    // Sifre degisince diger cihazlardaki oturumlar dusurulur.
    destroyAllSessionsFor(me.id);
    await createSession(me.id);

    return { ok: true, message: "Şifreniz güncellendi. Diğer oturumlar kapatıldı." };
  });
}
