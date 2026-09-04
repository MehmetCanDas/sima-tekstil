# -*- coding: utf-8 -*-
"""Katalog bloklarindan yapisal urun verisi uretir.

Eksik ticari veri (fiyat / SKU / beden / stok) UYDURULMAZ; null birakilir ve
dataGaps alaninda acikca isaretlenir.
"""
import json, os, re

BLOCKS = json.load(open("tools/catalog-blocks.json", encoding="utf-8"))

COLORS = [
    ("saks-mavi",  "Saks Mavi",  "#2B6FD4", ["SAKS MAVI"]),
    ("haki-yesil", "Haki Yesil", "#4A5340", ["HAKI YESIL", "HAKI"]),
    ("lacivert",   "Lacivert",   "#1B2A4A", ["LACIVERT"]),
    ("antrasit",   "Antrasit",   "#333739", ["ANTRASIT"]),
    ("turkuaz",    "Turkuaz",    "#0FA5A5", ["TURKUAZ"]),
    ("turuncu",    "Turuncu",    "#E4610F", ["TURUNCU"]),
    ("kirmizi",    "Kirmizi",    "#C4232B", ["KIRMIZI"]),
    ("bordo",      "Bordo",      "#6B1F2A", ["BORDO"]),
    ("siyah",      "Siyah",      "#101113", ["SIYAH"]),
    ("beyaz",      "Beyaz",      "#F2F2F0", ["BEYAZ"]),
    ("fume",       "Fume",       "#3A3E42", ["FUME"]),
    ("sari",       "Sari",       "#D9D416", ["SARI"]),
    ("yesil",      "Yesil",      "#9CC01A", ["YESIL"]),
    ("gri",        "Gri",        "#6E7376", ["GRI"]),
    ("mavi",       "Mavi",       "#1E9BD8", ["MAVI"]),
]

# Turkce goruntu adlari (UI'da kullanilan)
COLOR_TR = {
    "saks-mavi": "Saks Mavi", "haki-yesil": "Haki Yesil", "lacivert": "Lacivert",
    "antrasit": "Antrasit", "turkuaz": "Turkuaz", "turuncu": "Turuncu",
    "kirmizi": "Kirmizi", "bordo": "Bordo", "siyah": "Siyah", "beyaz": "Beyaz",
    "fume": "Fume", "sari": "Sari", "yesil": "Yesil", "gri": "Gri", "mavi": "Mavi",
}

TRMAP = str.maketrans({
    "Ç": "C", "Ğ": "G", "İ": "I", "Ö": "O",
    "Ş": "S", "Ü": "U", "ı": "I",
})


def ascii_up(s):
    return s.upper().translate(TRMAP)


# katalog slug -> (urun adi, kategori, alt kategori, sektorler, kumaslar, bolunmeli mi)
MAP = {
 "polar-mont": ("Polar Mont", "ust-giyim", "polar-mont", ["endustri", "belediye"], ["Polar"], False),
 "polar-mont-3-cepli": ("Polar Mont 3 Cepli", "ust-giyim", "polar-mont", ["endustri", "belediye"], ["Polar"], False),
 "softshell-polar-mont": ("Softshell Polar Mont", "ust-giyim", "softshell", ["endustri", "insaat"], ["Softshell", "Polar"], False),
 "sifir-yaka-sweat-2-iplik": ("Sıfır Yaka Sweatshirt (2 İplik)", "ust-giyim", "sweatshirt", ["endustri", "guvenlik"], ["2 İplik"], False),
 "polo-yaka-kisa-kol": ("Polo Yaka Kısa Kollu İş Tişörtü", "ust-giyim", "tisort", ["endustri", "belediye", "mutfak"], [], False),
 "sifir-yaka-kisa-kol-tisort": ("Sıfır Yaka Kısa Kollu İş Tişörtü", "ust-giyim", "tisort", ["endustri", "belediye"], [], False),
 "is-pantolonu": ("İş Pantolonu", "alt-giyim", "is-pantolonu", ["endustri", "insaat"], ["Harman Gabardin", "7/7 Gabardin", "Kot", "Likralı Kot", "Softshell", "Bondit"], True),
 "is-montu-kislik": ("Kışlık İş Montu", "ust-giyim", "is-montu", ["endustri", "insaat"], ["Gabardin", "Kot"], True),
 "is-yelegi": ("İş Yeleği", "yelek", "is-yelegi", ["endustri", "insaat"], ["16/12 Elyaflı", "7/7 Elyaflı Gabardin"], True),
 "softshell-mont-su-gecirmez": ("Su Geçirmez Softshell Mont", "ust-giyim", "softshell", ["endustri", "insaat", "guvenlik"], ["Softshell"], False),
 "softshell-yelek-su-gecirmez": ("Su Geçirmez Softshell Yelek", "yelek", "softshell-yelek", ["endustri", "insaat"], ["Softshell"], False),
 "3-cepli-yelek": ("3 Cepli Yelek", "yelek", "is-yelegi", ["endustri"], [], False),
 "ray-desenli-yelek": ("Ray Desenli Yelek", "yelek", "is-yelegi", ["endustri"], [], False),
 "kapitoneli-yelek": ("Kapitoneli Yelek", "yelek", "is-yelegi", ["endustri"], [], False),
 "askili-ve-kollu-tulum": ("Askılı ve Kollu Tulum", "tulum", "tulum", ["endustri", "insaat"], [], True),
 "muhendis-yonetici-ikaz-yelegi": ("Mühendis / Yönetici İkaz Yeleği", "yuksek-gorunurluk", "ikaz-yelegi", ["insaat", "belediye"], [], False),
 "muhendis-ve-isci-ikaz-yelegi": ("Mühendis ve İşçi İkaz Yeleği", "yuksek-gorunurluk", "ikaz-yelegi", ["insaat", "belediye"], [], True),
 "5in1-kaban-ve-parka": ("5in1 Kaban ve Parka", "yuksek-gorunurluk", "kaban-parka", ["insaat", "belediye"], ["Bondit", "Oxford Elyaflı"], True),
 "is-ayakkabisi": ("İş Ayakkabısı", "ayakkabi", "is-ayakkabisi", ["endustri", "insaat"], [], True),
 "ozel-guvenlik": ("Özel Güvenlik Kıyafetleri", "meslek-setleri", "ozel-guvenlik", ["guvenlik"], [], True),
 "pvc-yagmurluk": ("PVC Yağmurluk", "yagmurluk", "yagmurluk", ["belediye", "insaat"], ["PVC"], False),
 "esofman-ve-forma-cesitleri": ("Eşofman ve Forma Çeşitleri", "spor", "esofman-forma", ["spor"], [], True),
 "asci-uniformalari": ("Aşçı Üniformaları", "meslek-setleri", "mutfak", ["mutfak"], ["Alpaka"], True),
 "asci-takimi": ("Aşçı Takımı", "meslek-setleri", "mutfak", ["mutfak"], [], True),
 "hemsire-onlugu": ("Hemşire Önlüğü", "meslek-setleri", "saglik", ["saglik"], [], False),
 "doktor-onlugu": ("Doktor Önlüğü", "meslek-setleri", "saglik", ["saglik"], [], False),
 "polyester-ve-gabardin-sapka": ("Polyester ve Gabardin Şapka", "aksesuar", "sapka", ["endustri", "belediye"], ["Polyester", "Gabardin"], True),
 "polar-bere-ve-boyunluk": ("Polar Bere ve Boyunluk", "aksesuar", "bere-boyunluk", ["endustri", "belediye"], ["Polar"], True),
 "eldiven-cesitleri": ("Eldiven Çeşitleri", "aksesuar", "eldiven", ["endustri", "insaat"], [], True),
 "plastik-ve-metal-kalem-cesitleri": ("Plastik ve Metal Kalem Çeşitleri", "promosyon", "yazi-gerecleri", [], [], True),
 "cakmak-cesitleri": ("Çakmak Çeşitleri", "promosyon", "yazi-gerecleri", [], [], True),
 "ajanda-ve-defterler": ("Ajanda ve Defterler", "promosyon", "ofis-masa", [], [], True),
 "duvar-saatleri": ("Duvar Saatleri", "promosyon", "ofis-masa", [], [], True),
 "kupa-ve-anahtarlik-cesitleri": ("Kupa ve Anahtarlık Çeşitleri", "promosyon", "icecek", [], [], True),
 "matbaa-urunleri": ("Matbaa Ürünleri", "promosyon", "matbaa", [], [], True),
 "termos-cesitleri": ("Termos Çeşitleri", "promosyon", "icecek", [], [], True),
 "teknolojik-urun-ve-masa-setleri": ("Teknolojik Ürün ve Masa Setleri", "promosyon", "teknoloji", [], [], True),
}

CATS = {
 "ust-giyim":         ("Üst Giyim", "is-kiyafetleri"),
 "alt-giyim":         ("Alt Giyim", "is-kiyafetleri"),
 "yelek":             ("Yelekler", "is-kiyafetleri"),
 "tulum":             ("Tulum", "is-kiyafetleri"),
 "yuksek-gorunurluk": ("Yüksek Görünürlük", "is-kiyafetleri"),
 "yagmurluk":         ("Yağmurluk", "is-kiyafetleri"),
 "ayakkabi":          ("İş Ayakkabısı", "is-kiyafetleri"),
 "aksesuar":          ("Aksesuar", "is-kiyafetleri"),
 "meslek-setleri":    ("Mesleğe Özel Setler", "is-kiyafetleri"),
 "spor":              ("Spor ve Kulüp", "is-kiyafetleri"),
 "promosyon":         ("Promosyon Ürünleri", "promosyon"),
}

SECTORS = {
 "endustri": "Endüstri ve Fabrika",
 "insaat":   "İnşaat ve Saha",
 "guvenlik": "Özel Güvenlik",
 "mutfak":   "Mutfak ve Restoran",
 "saglik":   "Sağlık",
 "belediye": "Belediye ve Kamu",
 "spor":     "Spor ve Kulüp",
}


def parse_label(raw):
    """Etiketten renkleri ve renk olmayan notu ayirir."""
    t = " " + ascii_up(raw).replace("-", " ") + " "
    found = []
    for cid, _n, hex_, keys in COLORS:
        for k in keys:
            pat = r"(?<![A-Z0-9])" + re.escape(k) + r"(?![A-Z0-9])"
            if re.search(pat, t):
                if cid not in [f[0] for f in found]:
                    found.append((cid, COLOR_TR[cid], hex_))
                t = re.sub(pat, " ", t)
                break
    note = " ".join(t.split()).strip()
    return found, note


products, colormap = [], {}
for b in BLOCKS:
    m = MAP.get(b["slug"])
    if not m:
        continue
    name, cat, sub, sectors, fabrics, split = m
    colors, notes = [], []
    seen = set()
    for lab in b["labels"]:
        found, note = parse_label(lab)
        if found:
            sec = ({"id": found[1][0], "name": found[1][1], "hex": found[1][2]}
                   if len(found) > 1 else None)
            key = (found[0][0], sec["id"] if sec else None)
            if key not in seen:
                seen.add(key)
                colors.append({
                    "id": found[0][0], "name": found[0][1], "hex": found[0][2],
                    "secondary": sec, "label": lab,
                })
            for c in found:
                colormap[c[0]] = {"id": c[0], "name": c[1], "hex": c[2]}
        if note and len(note) > 2:
            notes.append(note.title())

    gaps = ["sku", "fiyat", "beden", "stok", "moq"]
    if not colors:
        gaps.append("renk")
    if split:
        gaps.append("urun-ayrimi")
    if cat in ("yuksek-gorunurluk", "ayakkabi"):
        gaps.append("sertifika")

    products.append({
        "id": "p%02d-%s" % (b["page"], b["slug"]),
        "slug": b["slug"],
        "name": name,
        "catalogTitle": b["title"],
        "category": cat,
        "subcategory": sub,
        "sectors": sectors,
        "fabrics": fabrics,
        "colors": colors,
        "variantNotes": sorted(set(notes)),
        "images": ["/catalog/%s/%s" % (b["dir"], f) for f in b["images"]],
        "sourcePage": b["page"],
        "sku": None,
        "listPrice": None,
        "currency": "TRY",
        "moq": None,
        "moqUnit": None,
        "sizes": [],
        "stockState": "TEYIT_GEREKLI",
        "certifications": [],
        "dataGaps": gaps,
        "needsSplit": split,
    })

# Katalogda ayni baslik iki kez geciyor olabilir (or. "POLAR MONT", s.2 ve s.4).
# Ayni slug ikinci urunu erisilmez yapar; katalog sayfasiyla ayristiriyoruz.
# Bunlarin ayri model mi tekrar mi oldugu firmadan teyit edilecek.
_slug_count = {}
for p in products:
    _slug_count[p["slug"]] = _slug_count.get(p["slug"], 0) + 1
for p in products:
    if _slug_count[p["slug"]] > 1:
        p["slug"] = "%s-s%d" % (p["slug"], p["sourcePage"])
        p["name"] = "%s (Katalog s. %d)" % (p["name"], p["sourcePage"])
        if "urun-ayrimi" not in p["dataGaps"]:
            p["dataGaps"].append("urun-ayrimi")

data = {
    "brand": {
        "name": "Sima Üniforma",
        "tagline": "Kurumsal & Endüstriyel İş Kıyafetleri",
        "owner": "Yusuf Taşören",
        "ownerTitle": "Kurucu & Genel Müdür",
        "phone": "0505 016 79 89",
        "phoneRaw": "+905050167989",
        "email": "simanakis32@gmail.com",
        "instagram": "yusuf_tasoren",
        "address": "Vatan Mah. Yeni Kavak Cad. Vatan Sit. A Blok Zemin Kat — Merkez / ISPARTA",
        "city": "Isparta",
        "missing": ["ticari unvan", "vergi dairesi / no", "mersis", "alan adı", "kurumsal e-posta"],
    },
    "categories": [{"id": k, "name": v[0], "world": v[1]} for k, v in CATS.items()],
    "sectors": [{"id": k, "name": v} for k, v in SECTORS.items()],
    "colors": list(colormap.values()),
    "products": products,
}

os.makedirs("web/src/data", exist_ok=True)
with open("web/src/data/catalog.json", "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)

print("urun:", len(products),
      "| renk:", len(colormap),
      "| gorselsiz:", sum(1 for p in products if not p["images"]),
      "| renksiz:", sum(1 for p in products if not p["colors"]),
      "| toplam gorsel:", sum(len(p["images"]) for p in products))
