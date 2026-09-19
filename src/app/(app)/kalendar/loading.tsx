import { Karta, Radek } from "@/components/kostra";

/** Kostra kalendáře — sedm dní, ať se stránka pod prsty nehýbe. */
export default function Nacitani() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Radek sirka="w-56" />
        <Radek sirka="w-64" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Karta key={i} radku={2} />
        ))}
      </div>

      <span className="sr-only">Načítám kalendář…</span>
    </div>
  );
}
