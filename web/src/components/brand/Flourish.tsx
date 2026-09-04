/* ---------------------------------------------------------------------------
 * Marka motifleri.
 *
 * Logo bir iplik kivrimi ve igne uzerine kurulu. Ayni cizgiyi sayfa boyunca
 * tekrarlamak, sert kutu izgarasina organik bir karsi ses veriyor ve kimligi
 * urun fotograflarinin otesine tasiyor.
 *
 * Hepsi sunucuda render edilen saf SVG: ekstra istek yok, renk currentColor
 * uzerinden geldigi icin koyu ve acik zeminde ayni bilesen kullanilir.
 * ------------------------------------------------------------------------ */

/** Bolumleri ayiran, tam genislikte akan iplik cizgisi. */
export function ThreadRule({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      className={`h-8 w-full text-accent/35 ${className}`}
    >
      <path
        d="M0 26 C 180 2, 330 40, 520 22 S 880 4, 1200 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Baslik ustunde duran kucuk iplik + yaprak isareti.
 * Logodaki yaprak dalinin sadelestirilmis hali.
 */
export function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 26"
      aria-hidden
      focusable="false"
      className={`h-[22px] w-auto text-accent ${className}`}
    >
      {/* akan iplik */}
      <path
        d="M0 18 C 10 6, 22 6, 30 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* dal */}
      <path
        d="M30 22 L 46 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* yapraklar */}
      <path
        d="M46 10 C 52 2, 62 3, 63 5 C 62 12, 53 15, 46 10 Z"
        fill="currentColor"
      />
      <path
        d="M38 16 C 40 9, 47 7, 49 8 C 48 14, 42 18, 38 16 Z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}

/**
 * Hero'nun arkasinda duran buyuk, cok soluk kivrim.
 * Dekoratif; icerigi hicbir sekilde etkilemez.
 */
export function HeroSwash({
  tone = "text-accent/[0.09]",
  className = "",
}: {
  /** Cizginin rengi. Varsayilan sinifla birlestirilmez, yerine gecer:
      iki renk sinifi ayni anda yazilinca hangisinin kazandigi belirsiz olur. */
  tone?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1400 620"
      aria-hidden
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${tone} ${className}`}
    >
      <path
        d="M-40 470 C 220 300, 300 120, 520 150 C 720 178, 700 430, 900 452 C 1090 472, 1180 300, 1440 210"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-40 540 C 260 400, 380 240, 620 262 C 850 283, 830 470, 1040 486 C 1220 500, 1260 380, 1440 320"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.7"
      />
    </svg>
  );
}
