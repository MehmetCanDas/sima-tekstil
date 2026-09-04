import Image from "next/image";
import Link from "next/link";

/* ---------------------------------------------------------------------------
 * Slaytin altindaki uc giris karti.
 *
 * Sitenin uc ana isini tek bakista veriyor: hazir katalog, logo uygulamasi ve
 * teklif akisi. Gorseller koyu bir perdeyle kapatiliyor ki uzerindeki beyaz
 * metin her fotografta okunabilsin.
 * ------------------------------------------------------------------------ */

export type FeatureCard = {
  href: string;
  title: string;
  subtitle: string;
  image: string;
};

export function FeatureCards({ cards }: { cards: FeatureCard[] }) {
  if (cards.length === 0) return null;

  return (
    /* Slaytin uzerine binmiyor: bindiginde slaytin noktalari kartlarin
       arkasinda kaliyor ve hangi slaytta olundugu gorunmuyordu. */
    <section aria-label="Hızlı erişim" className="u-wrap pt-6 md:pt-8">
      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group u-lift relative flex h-[132px] items-end overflow-hidden border border-line bg-ink md:h-[150px]"
            >
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover opacity-70 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-transparent"
              />
              <div className="relative p-5">
                <h3 className="font-display text-[19px] font-bold uppercase leading-tight text-white">
                  {card.title}
                </h3>
                <p className="mt-1 text-[13px] text-white/70">{card.subtitle}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-soft">
                  İncele
                  <span
                    aria-hidden
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
