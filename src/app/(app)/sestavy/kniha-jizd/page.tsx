import Link from "next/link";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { podpisy, terminy, ucitele, vozidla, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { nazevDne, rozsah as casovyRozsah } from "@/lib/cas";
import { naHodiny } from "@/lib/osnova";
import Obdobi, { jednaHodnota, okamziky, rozsahZAdresy } from "../obdobi";
import Tisk from "../tisk";
import PodpisNahled from "@/components/podpis-nahled";

/**
 * Kniha jízd — záznam o výcviku.
 *
 * Vypisuje jízdy tak, jak jsou naplánované a zapsané. Zrušené se
 * neukazují; jízda, která se neodjela, do knihy jízd nepatří.
 */
export const dynamic = "force-dynamic";

export default async function KnihaJizd({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const kdo = await vyzadujPrihlaseni();

  const r = rozsahZAdresy(p);
  const { zacatek, konec } = okamziky(r);
  const ucitelId = jednaHodnota(p.ucitel);
  const vozidloId = jednaHodnota(p.vozidlo);

  const data = await proAutoskolu(kdo, async (tx) => {
    const uciteleSeznam = await tx
      .select({ id: ucitele.id, jmeno: ucitele.jmeno, prijmeni: ucitele.prijmeni })
      .from(ucitele)
      .where(eq(ucitele.tenantId, kdo.autoskola.id))
      .orderBy(asc(ucitele.prijmeni));

    const vozidlaSeznam = await tx
      .select({ id: vozidla.id, znacka: vozidla.znacka, typ: vozidla.typ, rz: vozidla.rz })
      .from(vozidla)
      .where(eq(vozidla.tenantId, kdo.autoskola.id))
      .orderBy(asc(vozidla.znacka));

    const seznam = await tx
      .select({
        t: terminy,
        ucitel: ucitele,
        vozidlo: vozidla,
        evidencniCislo: vycviky.evidencniCislo,
        vycvikId: vycviky.id,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
      })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .leftJoin(vycviky, eq(vycviky.id, terminy.vycvikId))
      .leftJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          eq(terminy.druh, "jizda"),
          ne(terminy.stav, "zruseno"),
          gte(terminy.zacatek, zacatek),
          lte(terminy.zacatek, konec),
          ucitelId ? eq(terminy.ucitelId, ucitelId) : undefined,
          vozidloId ? eq(terminy.vozidloId, vozidloId) : undefined,
        ),
      )
      .orderBy(asc(terminy.zacatek));

    const idcka = seznam.map((x) => x.t.id);
    const podpisySeznam =
      idcka.length === 0
        ? []
        : await tx
            .select({ terminId: podpisy.terminId, kresba: podpisy.kresba })
            .from(podpisy)
            .where(
              and(
                eq(podpisy.tenantId, kdo.autoskola.id),
                inArray(podpisy.terminId, idcka),
              ),
            );

    return { uciteleSeznam, vozidlaSeznam, seznam, podpisySeznam };
  });

  const { uciteleSeznam, vozidlaSeznam, seznam, podpisySeznam } = data;

  const podpisTerminu = new Map(podpisySeznam.map((p) => [p.terminId, p.kresba]));

  const hodinCelkem = seznam.reduce((s, x) => s + naHodiny(x.t.delkaMinut), 0);

  // Sčítají se jen jízdy, které mají obě čísla. Chybějící se nedopočítává —
  // odhad v knize jízd je horší než přiznaná mezera.
  const kmCelkem = seznam.reduce(
    (s, x) =>
      x.t.kmZacatek !== null && x.t.kmKonec !== null
        ? s + (x.t.kmKonec - x.t.kmZacatek)
        : s,
    0,
  );

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
          Kniha jízd{" "}
          <span className="font-normal text-neutral-500">{kdo.autoskola.nazev}</span>
        </h1>
        <p className="text-sm text-neutral-500">
          {formatDatum(r.od)} – {formatDatum(r.do)} · {seznam.length}{" "}
          {seznam.length === 1 ? "jízda" : seznam.length < 5 ? "jízdy" : "jízd"} ·{" "}
          {Math.round(hodinCelkem * 10) / 10} h
          {kmCelkem > 0 ? ` · ${kmCelkem} km` : ""}
        </p>
      </div>

      <Obdobi
        cesta="/sestavy/kniha-jizd"
        rozsah={r}
        vybery={[
          {
            jmeno: "ucitel",
            popis: "Učitel",
            hodnota: ucitelId,
            moznosti: uciteleSeznam.map((u) => ({
              hodnota: u.id,
              popis: `${u.prijmeni} ${u.jmeno}`,
            })),
          },
          {
            jmeno: "vozidlo",
            popis: "Vozidlo",
            hodnota: vozidloId,
            moznosti: vozidlaSeznam.map((v) => ({
              hodnota: v.id,
              popis: `${v.znacka} ${v.typ} · ${v.rz}`,
            })),
          },
        ]}
      />

      {seznam.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ve vybraném období není zapsaná žádná jízda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Datum</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Čas</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Hod.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Žák</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Učitel</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Vozidlo</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                  Tachometr
                </th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Ujeto</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                  Místo / téma
                </th>
                <th className="py-2 text-xs font-medium text-neutral-500">Podpis</th>
              </tr>
            </thead>
            <tbody>
              {seznam.map((x) => (
                <tr
                  key={x.t.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className="text-neutral-500">{nazevDne(x.t.zacatek)} </span>
                    <span className="tabular-nums">
                      {x.t.zacatek.toLocaleDateString("cs-CZ")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {casovyRozsah(x.t.zacatek, x.t.delkaMinut)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{naHodiny(x.t.delkaMinut)}</td>
                  <td className="py-1.5 pr-3">
                    {x.jmeno ? (
                      <>
                        <span className="tabular-nums text-neutral-500">
                          {x.evidencniCislo}
                        </span>{" "}
                        {x.jmeno} {x.prijmeni}
                      </>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {x.ucitel ? `${x.ucitel.jmeno} ${x.ucitel.prijmeni}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {x.vozidlo ? (
                      <>
                        {x.vozidlo.znacka} {x.vozidlo.typ}{" "}
                        <span className="tabular-nums text-neutral-500">
                          {x.vozidlo.rz}
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        bez vozidla
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {x.t.kmZacatek !== null && x.t.kmKonec !== null ? (
                      `${x.t.kmZacatek} → ${x.t.kmKonec}`
                    ) : x.t.kmZacatek !== null ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {x.t.kmZacatek} → ?
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {x.t.kmZacatek !== null && x.t.kmKonec !== null
                      ? `${x.t.kmKonec - x.t.kmZacatek} km`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {[x.t.misto, x.t.tema].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-1.5">
                    <PodpisNahled kresba={podpisTerminu.get(x.t.id) ?? null} vyska={36} />
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
          Tiskne se jen tabulka, bez menu a filtrů.
        </p>
      </div>
    </main>
  );
}
