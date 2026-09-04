import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser, requirePermission } from "@/lib/auth/dal";
import { companyOptions } from "@/lib/admin/customers";
import { UserForm } from "../UserForm";

export const metadata: Metadata = { title: "Yeni hesap" };

export default async function NewCustomerPage() {
  await requirePermission("customer.create");
  const me = (await getCurrentUser())!;

  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/admin/musteriler" className="text-[13px] text-muted hover:text-ink">
        ← Kullanıcılar
      </Link>
      <h1 className="mb-1 mt-2 text-[26px] font-bold uppercase">Yeni hesap</h1>
      <p className="mb-6 text-[13px] text-ink-2">
        Panelden açılan hesaplar onay akışını atlar; durumu doğrudan siz belirlersiniz.
      </p>

      <div className="a-card p-5">
        <UserForm
          submitLabel="Hesabı oluştur"
          companies={companyOptions()}
          canAssignStaffRole={me.permissions.has("staff.manage")}
          values={{
            email: "",
            name: "",
            surname: "",
            phone: "",
            companyId: "",
            role: "customer",
            status: "active",
          }}
        />
      </div>
    </div>
  );
}
