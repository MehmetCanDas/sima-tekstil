import { LeafMark } from "./Flourish";

/**
 * Ic sayfalarin ortak baslik bandi.
 * Ana sayfadaki hero ile ayni sicak isigi ve yaprak isaretini tasir, boylece
 * sayfalar arasi gecis kopuk hissettirmez.
 */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="u-glow border-b border-line">
      <div className="u-wrap py-12 md:py-14">
        <span className="flex items-center gap-2.5">
          <LeafMark />
          <span className="u-eyebrow">{eyebrow}</span>
        </span>
        <h1 className="mt-3 max-w-[20ch] text-[clamp(34px,5.2vw,56px)] font-bold uppercase leading-[0.98]">
          {title}
        </h1>
        {children ? (
          <div className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
