import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const shots = [
  ["home-desktop", "/", 1440, 900, true],
  ["catalog-desktop", "/urunler", 1440, 900, false],
  ["product-desktop", "/urun/softshell-mont-su-gecirmez", 1440, 900, false],
  ["quote-desktop", "/teklif", 1440, 900, false],
  ["data-desktop", "/admin/veri-durumu", 1440, 900, false],
  ["home-mobile", "/", 390, 844, true],
  ["catalog-mobile", "/urunler", 390, 844, false],
];

const browser = await chromium.launch();
const errors = [];

for (const [name, path, w, h, full] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: full });
  await page.close();
}

await browser.close();
console.log(errors.length ? "KONSOL HATALARI:\n" + errors.join("\n") : "konsol hatasi yok");
