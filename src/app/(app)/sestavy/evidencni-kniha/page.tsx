import Link from "next/link";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import Obdobi, { jednaHodnota, rozsahZAdresy } from "../obdobi";
import Tisk from "../tisk";

/**
 * Evidenční kniha.
 *
 * Jeden řádek na jeden výcvik, ne na jednoho člověka — evidenční číslo
 * patří výcviku. Kdo se vrátí na rozšíření, má v knize dva řádky, a tak
 * to má být.
 *
 * Rodné číslo tu schválně není. V databázi leží zašifrované a na papír,
 * který se nosí po autoškole, nepatří; k rozlišení lidí stačí datum
 * narození. Kdyby ho tvůj formulář knihy vyžadoval, doplníme ho — ale
 * ať je to vědomé rozhodnutí, ne přehlédnutí.
 *
 * Období se počítá podle data zahájení výcviku. Řádky, které zahájení
 * vyplněné nemají, se ukazují taky — jinak by z knihy tiše vypadly.
 */
export const dynamic = "force-dynamic";

const STAVY: Record<string, string> = {
  zadost: "žádost podána",
  vycvik: "ve výcviku",
  ukonceno: "výcvik ukončen",
  zkousky: "u zkoušek",
  dokonceno: "dokončeno",
  zruseno: "zrušeno",
};

export default async function EvidencniKniha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const kdo = await vyzadujPrihlaseni();

  const r = rozsahZAdresy(p);
  const skupina = jednaHodnota(p.skupina);
  const vse = jednaHodnota(p.vse) === "ano";

  const seznam = await proAutoskolu(kdo, (tx) =>
    tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(
        and(
          eq(vycviky.tenantId, kdo.autoskola.id),
          skupina ? eq(vycviky.skupina, skupina) : undefined,
          vse
            ? undefined
            : or(
                isNull(vycviky.datumZahajeni),
                and(
                  gte(vycviky.datumZahajeni, r.od),
                  lte(vycviky.datumZahajeni, r.do),
                ),
              ),
        ),
      )
      .orderBy(asc(vycviky.evidencniCislo)),
  );

  const skupiny = [...new Set(seznam.map((x) => x.v.skupina))].sort();

  return (
    <main className="space-y-4">
      <div className="netisknout">
        <Link
          href="/sestavy"
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Sestavy
        </Link>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold">
          Evidenční kniha{" "}
          <span className="font-normal text-neutral-500">{kdo.autoskola.nazev}</span>
        </h1>
        <p className="text-sm text-neutral-500">
          {vse ? "vše" : `zahájení ${formatDatum(r.od)} – ${formatDatum(r.do)}`} ·{" "}
          {seznam.length}{" "}
          {seznam.length === 1 ? "záznam" : seznam.length < 5 ? "záznamy" : "záznamů"}
        </p>
      </div>

      <Obdobi
        cesta="/sestavy/evidencni-kniha"
        rozsah={r}
        vybery={[
          {
            jmeno: "skupina",
            popis: "Skupina",
            hodnota: skupina,
            moznosti: skupiny.map((s) => ({ hodnota: s, popis: s })),
          },
          {
            jmeno: "vse",
            popis: "Rozsah",
            hodnota: vse ? "ano" : "",
            moznosti: [{ hodnota: "ano", popis: "bez omezení datem" }],
          },
        ]}
      />

      {seznam.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ve vybraném období není žádný výcvik.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Č.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                  Jméno a příjmení
                </th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Narozen</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Bydliště</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Sk.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Zahájení</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Ukončení</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Přihláška</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                  1. zkouška
                </th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Dokončeno</th>
                <th className="py-2 text-xs font-medium text-neutral-500">Stav</th>
              </tr>
            </thead>
            <tbody>
              {seznam.map(({ v, z }) => (
                <tr
                  key={v.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="py-1.5 pr-3 tabular-nums">{v.evidencniCislo}</td>
                  <td className="py-1.5 pr-3">
                    {z.titul ? `${z.titul} ` : ""}
                    {z.jmeno} {z.prijmeni}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(z.datumNarozeni)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {[z.ulice, [z.psc, z.mesto].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="py-1.5 pr-3">{v.skupina}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(v.datumZahajeni)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(v.datumUkonceni)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(v.datumPrihlasky)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(v.datumPrvniZkousky)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {formatDatum(v.datumDokonceni)}
                  </td>
                  <td className="py-1.5 text-neutral-500">
                    {STAVY[v.stav] ?? v.stav}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Tisk />
        <p className="netisknout text-xs text-neutral-500">
          Na šířku papíru se to vejde jen naležato — v tiskovém dialogu přepni
          orientaci.
        </p>
      </div>
    </main>
  );
}
