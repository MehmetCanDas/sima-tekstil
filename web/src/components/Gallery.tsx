"use client";

import Image from "next/image";
import { useState } from "react";

export default function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center border border-line bg-white text-[14px] text-muted">
        Görsel bekleniyor
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden border border-line bg-white">
        <Image
          key={images[active]}
          src={images[active]}
          alt={`${alt} — görsel ${active + 1}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 560px"
          className="object-contain p-6"
        />
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-2">
          {images.slice(0, 12).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Görsel ${i + 1}`}
              aria-current={i === active}
              className={`relative aspect-square overflow-hidden border bg-white transition-colors ${
                i === active ? "border-accent" : "border-line hover:border-line-strong"
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="96px"
                className="object-contain p-1.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
