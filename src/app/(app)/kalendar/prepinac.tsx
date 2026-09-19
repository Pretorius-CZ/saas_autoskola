import Link from "next/link";

/**
 * Přepínač pohledu.
 *
 * Pohled i datum drží adresa, ne vnitřní stav — odkaz na konkrétní den
 * se dá poslat i uložit do oblíbených. Poslední volbu si aplikace
 * schválně nepamatuje: dělat to bez probliknutí znamená sáhnout na
 * cookies a zatím to za to nestojí.
 */
export const POHLEDY = [
  { klic: "den", popis: "Den" },
  { klic: "tyden", popis: "Týden" },
  { klic: "mesic", popis: "Měsíc" },
] as const;

export type Pohled = (typeof POHLEDY)[number]["klic"];

export default function Prepinac({
  pohled,
  datum,
}: {
  pohled: Pohled;
  datum: string;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
      {POHLEDY.map((p) => (
        <Link
          key={p.klic}
          href={`/kalendar?pohled=${p.klic}&datum=${datum}`}
          aria-current={p.klic === pohled ? "page" : undefined}
          className={`px-3 py-1.5 text-sm ${
            p.klic === pohled
              ? "bg-neutral-900 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
        >
          {p.popis}
        </Link>
      ))}
    </div>
  );
}
