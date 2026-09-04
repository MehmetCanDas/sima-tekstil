import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { CompanyForm } from "../CompanyForm";

export const metadata: Metadata = { title: "Yeni firma" };

export default async function NewCompanyPage() {
  await requirePermission("customer.create");

  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/admin/firmalar" className="text-[13px] text-muted hover:text-ink">
        ← Firmalar
      </Link>
      <h1 className="mb-1 mt-2 text-[26px] font-bold uppercase">Yeni firma</h1>
      <p className="mb-6 text-[13px] text-ink-2">
        Firma oluşturduktan sonra kullanıcıları bu firmaya bağlayabilirsiniz.
      </p>

      <div className="a-card p-5">
        <CompanyForm
          submitLabel="Firmayı oluştur"
          values={{
            name: "",
            taxNumber: "",
            taxOffice: "",
            country: "TR",
            city: "",
            address: "",
            phone: "",
            email: "",
            website: "",
            status: "active",
            discountBp: 0,
            currency: "TRY",
          }}
        />
      </div>
    </div>
  );
}
