/* ---------------------------------------------------------------------------
 * Rol ve izin tanimlari.
 *
 * Bu dosya istemciye de gidebilir (buton gizlemek icin), ama gizlemek guvenlik
 * degildir: her yazma islemi sunucuda requirePermission() ile yeniden dogrulanir.
 * ------------------------------------------------------------------------ */

export const PERMISSIONS = [
  "product.read",
  "product.create",
  "product.update",
  "product.delete",
  "product.import",
  "product.export",
  "category.read",
  "category.create",
  "category.update",
  "category.delete",
  "banner.read",
  "banner.update",
  "customer.read",
  "customer.create",
  "customer.update",
  "customer.approve",
  "customer.suspend",
  "customer.delete",
  "customer.price",
  "order.read",
  "order.update",
  "order.delete",
  "quote.read",
  "quote.update",
  "quote.convert",
  "quote.delete",
  "staff.read",
  "staff.manage",
  "settings.read",
  "settings.update",
  "log.read",
  "report.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "customer",
  "company_admin",
  "sales_manager",
  "admin",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Müşteri",
  company_admin: "Firma Yöneticisi",
  sales_manager: "Satış Yöneticisi",
  admin: "Admin",
  super_admin: "Süper Admin",
};

/** Panele girebilen roller. Musteri rolleri panele hic giremez. */
export const STAFF_ROLES: readonly Role[] = ["sales_manager", "admin", "super_admin"];

const SALES_MANAGER: Permission[] = [
  "product.read",
  "product.update",
  "product.export",
  "category.read",
  "banner.read",
  "customer.read",
  "customer.update",
  "customer.price",
  "order.read",
  "order.update",
  "quote.read",
  "quote.update",
  "quote.convert",
  "report.read",
];

const ADMIN: Permission[] = [
  ...SALES_MANAGER,
  "product.create",
  "product.delete",
  "product.import",
  "category.create",
  "category.update",
  "category.delete",
  "banner.update",
  "customer.create",
  "customer.approve",
  "customer.suspend",
  "order.delete",
  "quote.delete",
  "settings.read",
  "log.read",
];

/** Rolun varsayilan izinleri. Kullanici bazli istisnalar bunun uzerine biner. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  company_admin: [],
  sales_manager: SALES_MANAGER,
  admin: ADMIN,
  super_admin: [...PERMISSIONS],
};

export type PermissionOverride = { permission: string; allow: boolean };

/** Rolden gelen izinlerin uzerine kullanici istisnalarini uygular. */
export function resolvePermissions(
  role: string,
  overrides: readonly PermissionOverride[] = [],
): Set<Permission> {
  const base = ROLE_PERMISSIONS[role as Role] ?? [];
  const set = new Set<Permission>(base);
  for (const o of overrides) {
    if (!isPermission(o.permission)) continue;
    if (o.allow) set.add(o.permission);
    else set.delete(o.permission);
  }
  return set;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(value: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/** Izinlerin panelde gruplu gosterimi. */
export const PERMISSION_GROUPS: { title: string; prefix: string }[] = [
  { title: "Ürünler", prefix: "product." },
  { title: "Kategoriler", prefix: "category." },
  { title: "Ana sayfa görselleri", prefix: "banner." },
  { title: "Müşteriler", prefix: "customer." },
  { title: "Siparişler", prefix: "order." },
  { title: "Teklifler", prefix: "quote." },
  { title: "Ekip", prefix: "staff." },
  { title: "Sistem", prefix: "settings." },
  { title: "Kayıtlar", prefix: "log." },
  { title: "Raporlar", prefix: "report." },
];
