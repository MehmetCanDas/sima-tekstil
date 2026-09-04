import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ust dizinlerde baska bir lock dosyasi bulundugunda Turbopack yanlis kok
  // secebiliyor; kokunu acikca bu klasore sabitliyoruz.
  turbopack: { root: path.resolve(process.cwd()) },
  experimental: {
    serverActions: {
      // Varsayilan 1 MB; gorsel yukleme formlari bu sinira takilip daha
      // koda ulasmadan 500 donuyordu. Uygulamanin kendi sinirlari
      // src/lib/admin/upload-limits.ts icinde ve bu tavanin altinda.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Next 16'da bu degerin varsayilani 60 saniyeden 4 SAATE cikti. Bir gorsel
    // dosyasi ayni adla degistirildiginde (or. public/hero/slide-2.jpg) site
    // 4 saat boyunca eskisini gostermeye devam ediyordu. Panelden yuklenen urun
    // gorselleri benzersiz ad aldigi icin onlari etkilemiyor; ama elle
    // degistirilen marka gorselleri icin bu davranis kafa karistirici.
    // 60 saniye: dosyayi degistirip yenileyince en gec bir dakikada gorunur.
    minimumCacheTTL: 60,
    // Kucuk kart/kucuk resim olculeri.
    imageSizes: [64, 96, 128, 200, 256, 320],
    // Ana sayfa slayti genis ekranda ~1500px yer kapliyor. Ust sinir 1080'de
    // kaldigi surece 1920'lik bir kaynak bile 1080'e indirilip tarayicida
    // yeniden buyutuluyor ve bulaniklasiyordu.
    deviceSizes: [420, 640, 828, 1080, 1280, 1600, 1920, 2560],
    formats: ["image/webp"],
  },
};

export default nextConfig;
