import pymupdf, collections, json, os, re, unicodedata

SRC = "catolog/sima katalog son.pdf"
OUT = "web/public/catalog"
doc = pymupdf.open(SRC)

TR = str.maketrans("çÇğĞıİöÖşŞüÜ", "cCgGiIoOsSuU")
def slug(s):
    s = s.translate(TR)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-+", "-", s)

# xref frequency -> drop logos/decoration that repeat across pages
freq = collections.Counter()
for p in doc:
    for x in {i[0] for i in p.get_images(full=True)}:
        freq[x] += 1

os.makedirs(OUT, exist_ok=True)
blocks = []
for pno, page in enumerate(doc, 1):
    if pno in (1, 23, 24):
        continue
    heads = []
    labels = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = " ".join(s["text"].split())
                if not t:
                    continue
                if s["font"] == "Barlow-Bold" and s["size"] >= 11:
                    heads.append((s["bbox"][1], t))
                elif s["size"] < 11 and not t.isdigit():
                    labels.append((s["bbox"][1], s["bbox"][0], t))
    heads.sort(); labels.sort()
    if not heads:
        continue

    infos = []
    for im in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = im["bbox"]
        w, h = x1 - x0, y1 - y0
        if w < 28 or h < 28:
            continue
        if freq[im["xref"]] > 3:          # repeated => logo/decor
            continue
        infos.append((y0, x0, w * h, im["xref"]))

    for hi, (hy, ht) in enumerate(heads):
        nexty = heads[hi + 1][0] if hi + 1 < len(heads) else 1e9
        mine = sorted([i for i in infos if hy <= i[0] < nexty], key=lambda r: -r[2])
        if not mine:
            continue
        sl = slug(ht)
        d = os.path.join(OUT, f"p{pno:02d}-{sl}")
        os.makedirs(d, exist_ok=True)
        files = []
        for idx, (y0, x0, area, xref) in enumerate(mine):
            try:
                info = doc.extract_image(xref)
            except Exception:
                continue
            ext = info["ext"]
            if ext == "jpx":
                ext = "png"
                pix = pymupdf.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                data = pix.tobytes("png")
            else:
                data = info["image"]
            name = f"{idx:02d}.{ext}"
            open(os.path.join(d, name), "wb").write(data)
            files.append(name)
        blocks.append({
            "page": pno,
            "title": ht,
            "slug": sl,
            "dir": f"p{pno:02d}-{sl}",
            "labels": [t for _, _, t in labels if hy <= _ < nexty] if False else
                      [t for y, x, t in labels if hy <= y < nexty],
            "images": files,
        })

json.dump(blocks, open("tools/catalog-blocks.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("bloklar:", len(blocks), "| toplam görsel:", sum(len(b["images"]) for b in blocks))
