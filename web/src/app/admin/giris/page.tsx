import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/rbac";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Yönetim Girişi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Oturum zaten acikken giris formunu gostermenin anlami yok.
  const user = await getCurrentUser();
  if (user && isStaffRole(user.role)) redirect("/admin");

  return (
    <div className="admin-theme flex min-h-dvh items-center justify-center bg-surface p-5">
      <div className="w-[min(400px,100%)]">
        <div className="mb-6 text-center">
          <span className="font-display text-[30px] font-bold uppercase tracking-tight">
            Sima
          </span>
          <span className="ml-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
            Yönetim
          </span>
        </div>
        <div className="a-card p-6">
          <h1 className="text-[22px] font-semibold uppercase">Giriş</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Bu alan yalnızca yetkili personel içindir.
          </p>
          <LoginForm next={next} />
        </div>
        <p className="mt-4 text-center text-[12px] text-muted">
          Şifrenizi unuttuysanız sistem yöneticinizle görüşün.
        </p>
      </div>
    </div>
  );
}
