# Yönetim Paneli

Vitrin sitesinin altındaki B2B yönetim sistemi. Ürünler, kategoriler, müşteriler,
teklifler ve siparişler tek panelden yönetilir.

## Kurulum

```bash
npm install
npm run db:migrate      # şemayı oluşturur (data/sima.db)
npm run db:seed         # katalogdan ürünleri yükler + süper admin açar
npm run dev
```

`db:seed` süper admin şifresini bir kez ekrana yazar. Kendi hesabınızla kurmak için:

```bash
ADMIN_EMAIL=siz@firma.com ADMIN_PASSWORD='...' npm run db:seed
```

Panel: `/admin` · Giriş: `/admin/giris`

Şema değiştiğinde: `npm run db:generate` (migration üretir) → `npm run db:migrate`.

## Mimari

| Katman | Yer | Not |
| --- | --- | --- |
| Şema | `src/db/schema.ts` | Drizzle + SQLite. Postgres'e taşınırken yalnızca driver ve `pg-core` importu değişir. |
| Bağlantı | `src/db/index.ts` | Tek `better-sqlite3` bağlantısı, WAL açık. |
| Oturum | `src/lib/auth/session.ts` | Sunucu tarafı oturum; cookie sadece token taşır, veritabanında SHA-256 özeti durur. |
| Şifre | `src/lib/auth/password.ts` | Node `scrypt`, parametreler hash içinde saklanır. |
| Yetki | `src/lib/auth/rbac.ts` + `dal.ts` | Rol → izin haritası ve kullanıcı bazlı istisnalar. |
| Yazma işlemleri | `src/lib/admin/*.actions.ts` | Server action; ilk satır `requirePermission`. |
| Denetim kaydı | `src/lib/admin/log.ts` | Sadece değişen alanları yazar. |

### Güvenlik kuralı

Panel rotaları public siteden ayrıdır: `src/app/(site)` vitrin, `src/app/admin/(panel)`
yönetim. Kök yerleşim yalnızca `<html>` ve yazı tiplerini kurar.

### Veri kaynağı

Vitrin (`src/lib/storefront.ts`) ve panel **aynı veritabanını** okur; panelde
yapılan her değişiklik siteye anında yansır. `src/data/catalog.json` artık yalnızca
ilk kurulum verisi (`npm run db:seed`) ve firma bilgileri içindir — ürün sorguları
oradan kaldırıldı, iki ayrı kaynak olması panelde yapılan değişikliklerin sitede
görünmemesine yol açıyordu.

Sitede yalnızca `status = active` ürünler görünür. Ürün yazan her server action
`revalidateStorefront()` çağırır.

### Fiyatlandırma

Bir üründe iki fiyat olabilir: **liste fiyatı** ve belirli bir adetten sonra geçerli
**toptan fiyat**. İkisi birlikte anlam kazandığı için toptan fiyat girildiğinde
"toptan geçerlilik adedi" zorunludur (ve toptan fiyat listeden düşük olmalıdır).

Kural tek dosyada: `src/lib/pricing.ts`. Ürün sayfası, teklif listesi ve teklif API'si
aynı fonksiyonu kullanır; ekranda görünen fiyatla kaydedilen fiyat ayrışamaz.
Kademe satırın **toplam adedine** göre belirlenir — bedenlere bölünmesi kademeyi
düşürmez.

### Renk kapsamı

Vitrin markanın logosundan türetilen sıcak krem/terrakota paletini kullanır
(`@theme`, `globals.css`). Panel ise `.admin-theme` sınıfıyla nötr grafit paletine
döner; bu sınıf panel yerleşiminin ve giriş ekranının en dış elemanındadır.
Panele yeni bir üst seviye ekran eklerken bu sınıfın kapsamında kaldığından emin
olun, yoksa ekran vitrin renklerini alır.

Her yazma işlemi sunucuda yeniden doğrulanır. Menüde bir bağlantının görünmemesi
veya bir butonun gizlenmesi yetkilendirme **değildir** — yalnızca gürültü azaltır.

### Para ve zaman

Para değerleri tam sayı olarak kuruş (`priceMinor`) tutulur; float yuvarlama hatası
olmaz. Zaman damgaları epoch milisaniyedir.

### Silme

Ürün, müşteri, firma, sipariş ve teklif fiziksel olarak silinmez: `status` +
`deletedAt`. Yanlışlıkla arşivlenen kayıt geri alınabilir.

## Roller

| Rol | Panele girer | Varsayılan yetki |
| --- | --- | --- |
| `customer` | hayır | — |
| `company_admin` | hayır | kendi firma hesabı (vitrin tarafı) |
| `sales_manager` | evet | ürün okuma/güncelleme, müşteri, teklif, sipariş |
| `admin` | evet | + oluşturma/silme, kategori, onay, ayar okuma, kayıtlar |
| `super_admin` | evet | tüm izinler |

İzin listesi `src/lib/auth/rbac.ts` içinde; kullanıcı bazlı ek/iptal
`user_permissions` tablosundadır.

## Durum

Panelin tüm bölümleri çalışır durumda:

**Katalog** — ürün listesi (arama, filtre, sıralama, sayfalama, toplu işlemler),
ürün oluşturma/düzenleme/arşivleme, Renk × Beden varyant tablosu (ayrı SKU, stok,
fiyat), görsel yönetimi, kategori ağacı, veri durumu raporu.

**Satış** — teklif listesi ve detayı (kalem fiyatı girme, durum, geçerlilik tarihi,
müşteriye görünen not + dahili not), teklifin siparişe çevrilmesi, sipariş listesi
ve detayı (durum akışı, kargo takip, notlar). Vitrindeki teklif formu artık
veritabanına yazıyor: `/teklif` sayfasından gelen talep panelde "Yeni" olarak düşer.

**Müşteriler** — kullanıcı listesi ve detay panosu (bilgiler, siparişler, teklifler,
favoriler, aktivite, dahili notlar), onay akışı (onayla / reddet / askıya al),
B2B firma kayıtları, firma altında birden fazla kullanıcı, firmaya özel iskonto ve
ürün bazlı müşteriye özel fiyat.

**Sistem** — ekip ve granular izin matrisi (rol varsayılanı + kişiye özel istisna,
açık oturumları kapatma), işlem kayıtları (kim, ne zaman, hangi alanı neyle
değiştirdi), site ayarları (onay akışı ve fiyat görünürlüğü feature flag'leri,
varsayılan para birimi, düşük stok eşiği), kendi şifreni değiştirme.

Henüz yapılmadı:

- Excel/CSV/JSON içe–dışa aktarma ve import önizlemesi (spec 4)
- Firma bilgileri (ad, adres, telefon) hâlâ `catalog.json`'dan geliyor; panelden
  düzenlenmiyor
- Vitrin tarafında ürün görüntüleme / sepete ekleme olaylarının kaydı — müşteri
  detayındaki "Aktivite" sekmesi şimdilik yalnızca teklif taleplerini gösterir
- Teklif ve sipariş bildirim e-postaları (e-posta servisi kurulmadı)
- Müşteriye özel fiyatların vitrinde uygulanması — veri ve panel hazır, ürün
  sayfası henüz bu fiyatı okumuyor

## Bilinen sınırlar

- Görseller `public/uploads/` altına yazılır ve `next/image` ile boyutlandırılıp WebP
  olarak sunulur; yükleme anında yeniden kodlama yapılmaz. Nesne depolamaya geçmek
  için yalnızca `uploadImagesAction` değişir.
- Stok tek depoludur. Çok depolu yapıya geçildiğinde `inventory` tablosu eklenir ve
  `src/lib/admin/stock.ts` dışındaki çağrı yerleri değişmez.
- `data/` ve `public/uploads/` sürüm kontrolüne girmez; yedekleme ayrıca kurulmalı.
