import { formatDatum } from "@/lib/datum";
import {
  NAZVY_AKCI,
  NAZVY_POLI,
  NAZVY_TABULEK,
  jeOdkaz,
} from "@/lib/historie-nazvy";

export type RadekHistorie = {
  id: string;
  kdy: Date;
  tabulka: string;
  /** Kterého záznamu se změna týká. Potřebné jen ve společné historii. */
  zaznamId?: string | null;
  akce: string;
  pole: string | null;
  hodnotaPred: string | null;
  hodnotaPo: string | null;
  uzivatelId: string | null;
};

/**
 * Výpis historie změn.
 *
 * `nazvy` překládá odkazy (dlouhá náhodná čísla) na jména — bez toho by
 * v tabulce stálo "kurz_id: 8f3c… → a91b…", což nikomu nic neřekne.
 *
 * `koho` se předává jen ve společné historii za celou evidenci, kde na
 * jednom místě leží změny víc záznamů. Pak první sloupec neříká "učitel",
 * což by u seznamu učitelů bylo k ničemu, ale o kterého učitele jde.
 */
export default function HistorieTabulka({
  radky,
  nazvy,
  lide,
  koho,
}: {
  radky: RadekHistorie[];
  nazvy: Map<string, string>;
  lide: Map<string, string>;
  koho?: Map<string, string>;
}) {
  function hodnota(v: string | null, pole: string | null) {
    if (v === null || v === "") return <span className="text-neutral-400">—</span>;
    if (jeOdkaz(pole)) return nazvy.get(v) ?? <span className="text-neutral-400">neznámé</span>;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDatum(v);
    if (v === "true") return "ano";
    if (v === "false") return "ne";
    return v;
  }

  if (radky.length === 0) {
    return <p className="text-sm text-neutral-500">Zatím tu nic není.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
            <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Kdy</th>
            <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
              {koho ? "Koho se týká" : "Kde"}
            </th>
            <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Údaj</th>
            <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Původní</th>
            <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Nová</th>
            <th className="py-2 text-xs font-medium text-neutral-500">Kdo</th>
          </tr>
        </thead>
        <tbody>
          {radky.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-neutral-500">
                {r.kdy.toLocaleString("cs-CZ")}
              </td>
              <td className="py-1.5 pr-3 text-neutral-500">
                {koho
                  ? (koho.get(r.zaznamId ?? "") ?? "smazaný záznam")
                  : (NAZVY_TABULEK[r.tabulka] ?? r.tabulka)}
              </td>
              <td className="py-1.5 pr-3">
                {r.akce === "zmena"
                  ? (NAZVY_POLI[r.pole ?? ""] ?? r.pole)
                  : (NAZVY_AKCI[r.akce] ?? r.akce)}
              </td>
              <td className="py-1.5 pr-3">
                {r.akce === "zmena" ? hodnota(r.hodnotaPred, r.pole) : null}
              </td>
              <td className="py-1.5 pr-3">
                {r.akce === "zmena" ? hodnota(r.hodnotaPo, r.pole) : null}
              </td>
              <td className="py-1.5 text-neutral-500">
                {r.uzivatelId ? (lide.get(r.uzivatelId) ?? "—") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
