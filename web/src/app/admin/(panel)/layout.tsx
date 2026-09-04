import type { Metadata } from "next";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { orders, quotes, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { logoutAction } from "@/lib/auth/actions";
import { Sidebar, type NavSection } from "@/components/admin/Sidebar";
import { Toaster } from "@/components/admin/Toaster";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s · Sima Yönetim" },
  robots: { index: false, follow: false },
};

/** Panel her istekte oturumu dogrular; onbelleklenmemeli. */
export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff();
  const can = (p: string) => user.permissions.has(p as never);

  // Menudeki is yigini rozetleri. Tek tek COUNT; hepsi indeksli sorgular.
  const pendingCustomers = can("customer.read")
    ? (db
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.status, "pending"), isNull(users.deletedAt)))
        .get()?.n ?? 0)
    : 0;

  const openQuotes = can("quote.read")
    ? (db
        .select({ n: count() })
        .from(quotes)
        .where(
          and(
            inArray(quotes.status, ["new", "in_review"]),
            isNull(quotes.deletedAt),
          ),
        )
        .get()?.n ?? 0)
    : 0;

  const newOrders = can("order.read")
    ? (db
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.status, "pending"), isNull(orders.deletedAt)))
        .get()?.n ?? 0)
    : 0;

  const sections: NavSection[] = [
    {
      title: "Genel",
      items: [{ href: "/admin", label: "Panel" }],
    },
    {
      title: "Katalog",
      items: [
        ...(can("product.read")
          ? [{ href: "/admin/urunler", label: "Ürünler" }]
          : []),
        ...(can("category.read")
          ? [{ href: "/admin/kategoriler", label: "Kategoriler" }]
          : []),
        ...(can("banner.read")
          ? [{ href: "/admin/banner", label: "Ana sayfa görselleri" }]
          : []),
        ...(can("product.read")
          ? [{ href: "/admin/veri-durumu", label: "Veri durumu" }]
          : []),
      ],
    },
    {
      title: "Satış",
      items: [
        ...(can("quote.read")
          ? [
              {
                href: "/admin/teklifler",
                label: "Teklifler",
                badge: openQuotes,
              },
            ]
          : []),
        ...(can("order.read")
          ? [
              {
                href: "/admin/siparisler",
                label: "Siparişler",
                badge: newOrders,
              },
            ]
          : []),
      ],
    },
    {
      title: "Müşteriler",
      items: [
        ...(can("customer.read")
          ? [
              {
                href: "/admin/musteriler",
                label: "Kullanıcılar",
                badge: pendingCustomers,
              },
              { href: "/admin/firmalar", label: "Firmalar" },
            ]
          : []),
      ],
    },
    {
      title: "Sistem",
      items: [
        ...(can("staff.read")
          ? [{ href: "/admin/ekip", label: "Ekip ve yetkiler" }]
          : []),
        ...(can("log.read")
          ? [{ href: "/admin/kayitlar", label: "İşlem kayıtları" }]
          : []),
        ...(can("settings.read")
          ? [{ href: "/admin/ayarlar", label: "Ayarlar" }]
          : []),
      ],
    },
  ].filter((s) => s.items.length > 0);

  return (
    // admin-theme: panel vitrinin sicak krem paletinden ayrilir, notr kalir.
    <div className="admin-theme">
      <Toaster>
        <div className="a-shell">
          <Sidebar
            sections={sections}
            userName={`${user.name} ${user.surname}`.trim()}
            roleLabel={ROLE_LABEL[user.role]}
          />
          <div className="flex min-w-0 flex-col">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg px-5 py-2.5 max-md:pl-20">
              <div className="ml-auto flex items-center gap-3">
                <span className="text-[13px] text-muted max-sm:hidden">
                  {user.email}
                </span>
                <form action={logoutAction}>
                  <button type="submit" className="a-btn a-btn-ghost a-btn-sm">
                    Çıkış
                  </button>
                </form>
              </div>
            </header>
            <div className="min-w-0 flex-1 p-5">{children}</div>
          </div>
        </div>
      </Toaster>
    </div>
  );
}
