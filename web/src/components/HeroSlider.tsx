"use client";

import { Img as Image } from "@/components/Img";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
 * Ana sayfa gorsel gecisi.
 *
 * Her slayt tam genislik kaplar; komsu slaytlar hic gorunmez. Daha once
 * kenarlardan tasan bir "onizleme" vardi ama yandaki gorsel aktif slaytin
 * parcasi gibi okunuyordu.
 *
 * Gecis yollari: oklar, noktalar, klavye ok tuslari, dokunmatikte kaydirma.
 * Otomatik gecis kullanici elle bir gecis yaptigi anda kalici olarak durur;
 * hareketi azaltma tercihi acikken hic baslamaz.
 * ------------------------------------------------------------------------ */

export type HeroSlide = {
  src: string;
  alt: string;
  /** Ustte gorunen kucuk etiket. */
  eyebrow?: string;
  title?: string;
  /** Basligin altindaki el yazisi hissi veren ikinci satir. */
  accentTitle?: string;
  ctas?: { href: string; label: string; primary?: boolean }[];
  /**
   * Ekran orani gorselden farkli oldugunda kirpmanin hangi kenari koruyacagi
   * (CSS object-position).
   */
  focus?: string;
};

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD = 50;

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragStart = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (stopped || focused || reducedMotion || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [stopped, focused, reducedMotion, count]);

  /** Elle yapilan her gecis otomatik akisi durdurur. */
  const goManual = useCallback(
    (next: number) => {
      setStopped(true);
      go(next);
    },
    [go],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goManual(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goManual(index - 1);
    }
  }

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne çıkan görseller"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      onPointerDown={(e) => {
        dragStart.current = e.clientX;
      }}
      onPointerUp={(e) => {
        const start = dragStart.current;
        dragStart.current = null;
        if (start === null) return;
        const delta = e.clientX - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD) return;
        goManual(index + (delta < 0 ? 1 : -1));
      }}
      className="relative w-full touch-pan-y overflow-hidden bg-surface"
    >
      <div
        className={`flex ${
          reducedMotion
            ? ""
            : "transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        }`}
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            aria-hidden={i !== index}
            /* Sabit oran: yukseklik ekran yuksekligine baglanınca slaytin orani
               2.08:1 ile 2.88:1 arasinda degisiyordu ve gorsel her ekranda
               farkli kirpiliyordu. Sabit oranla tasarimci tek bir olcuye
               calisabiliyor. Mobilde daha kare bir oran kullanilir. */
            className="relative aspect-[16/10] w-full shrink-0 md:aspect-[21/9]"
          >
            <div className="relative h-full w-full overflow-hidden">
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes="100vw"
                priority={i === 0}
                style={slide.focus ? { objectPosition: slide.focus } : undefined}
                className="object-cover"
              />

              {(slide.title || slide.ctas) && (
                <>
                  {/* Metnin okunmasi icin alttan yukari koyulasan perde. */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-center md:p-12">
                    {slide.eyebrow && (
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                        {slide.eyebrow}
                      </span>
                    )}
                    {slide.title && (
                      <h2 className="mt-2 text-[clamp(22px,3.4vw,44px)] font-bold uppercase leading-[1.05] text-white">
                        {slide.title}
                        {slide.accentTitle && (
                          <span className="block font-display text-[clamp(20px,3vw,38px)] font-medium normal-case italic text-accent-soft">
                            {slide.accentTitle}
                          </span>
                        )}
                      </h2>
                    )}
                    {slide.ctas && (
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        {slide.ctas.map((cta) => (
                          <Link
                            key={cta.href}
                            href={cta.href}
                            tabIndex={i === index ? undefined : -1}
                            className={
                              cta.primary
                                ? "u-btn u-btn-primary"
                                : "u-btn border-white/50 text-white hover:border-white hover:bg-white/10"
                            }
                          >
                            {cta.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <Arrow side="left" onClick={() => goManual(index - 1)} />
          <Arrow side="right" onClick={() => goManual(index + 1)} />

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2.5 md:bottom-5">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => goManual(i)}
                aria-label={`${i + 1}. görsele git`}
                aria-current={i === index}
                className={`h-2.5 w-2.5 rounded-full border border-white transition-colors ${
                  i === index ? "bg-white" : "bg-white/20 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          <p aria-live="polite" className="sr-only">
            {index + 1} / {count}
          </p>
        </>
      )}
    </section>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Önceki görsel" : "Sonraki görsel"}
      className={`absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-bg/90 text-[20px] leading-none text-ink shadow-sm transition-colors hover:bg-bg md:h-11 md:w-11 ${
        side === "left" ? "left-2 md:left-5" : "right-2 md:right-5"
      }`}
    >
      <span aria-hidden>{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}
