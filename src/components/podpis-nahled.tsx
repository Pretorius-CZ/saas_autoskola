import { kresbaZTextu } from "@/lib/podpis-typy";

/**
 * Vykreslení uloženého podpisu.
 *
 * Bez javascriptu a bez vkládání cizího HTML — body se vypíšou jako
 * souřadnice do SVG. Tiskne se to ostře v jakékoli velikosti.
 */
export default function PodpisNahled({
  kresba,
  vyska = 48,
}: {
  kresba: string | null;
  vyska?: number;
}) {
  const k = kresbaZTextu(kresba);

  if (!k || k.tahy.length === 0) {
    return <span className="text-neutral-400">—</span>;
  }

  return (
    <svg
      viewBox={`0 0 ${k.sirka} ${k.vyska}`}
      style={{ height: vyska, width: (vyska * k.sirka) / k.vyska }}
      role="img"
      aria-label="Podpis"
      className="text-neutral-900 dark:text-neutral-100"
    >
      {k.tahy.map((tah, i) => (
        <polyline
          key={i}
          points={tah.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
