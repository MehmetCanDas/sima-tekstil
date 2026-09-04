import Link from "next/link";
import { LeafMark } from "./Flourish";

/* ---------------------------------------------------------------------------
 * Bolum basligi.
 *
 * Vitrindeki her bolum ayni ritmi kullansin diye tek bilesende toplandi:
 * yaprak isareti + kucuk etiket, buyuk baslik, istege bagli aciklama ve
 * sag ust kose baglantisi.
 * ------------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "Tümünü gör",
  align = "start",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  align?: "start" | "center";
}) {
  const centered = align === "center";

  return (
    <div
      className={`flex flex-wrap gap-x-8 gap-y-3 ${
        centered
          ? "flex-col items-center text-center"
          : "items-end justify-between"
      }`}
    >
      <div className={centered ? "max-w-[58ch]" : "max-w-[62ch]"}>
        {eyebrow ? (
          <span
            className={`flex items-center gap-2.5 ${centered ? "justify-center" : ""}`}
          >
            <LeafMark />
            <span className="u-eyebrow">{eyebrow}</span>
          </span>
        ) : null}
        <h2 className="mt-3 text-[clamp(27px,3.6vw,42px)] font-semibold uppercase leading-[1.03]">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>

      {href ? (
        <Link href={href} className="u-link-arrow shrink-0 pb-1">
          {linkLabel}
          <span aria-hidden className="u-link-arrow-icon">
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}
