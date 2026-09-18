import Link from "next/link";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucast, ucitele, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { nazevDne, rozsah as casovyRozsah } from "@/lib/cas";
import { PREDMETY, naHodiny } from "@/lib/osnova";
import Obdobi, { jednaHodnota, okamziky, rozsahZAdresy } from "../obdobi";
import Tisk from "../tisk";

/**
 * Třídní kniha — záznam o výuce.
 *
 * Nic se tu nedopočítává. Sestava vypisuje termíny výuky a u nich to, co
 * je zapsané v docházce. Když u termínu docházka zapsaná není, je to tu
 * napsané; tiché "nikdo nepřišel" by z papíru nešlo poznat od "nikdo se
 * neptal".
 */
export const dynamic = "force-dynamic";

export default async function TridniKniha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const kdo = await vyzadujPrihlaseni();

  const r = rozsahZAdresy(p);
  const { zacatek, konec } = okamziky(r);
  const kurzId = jednaHodnota(p.kurz);

  const data = await proAutoskolu(kdo, async (tx) => {
    const kurzySeznam = await tx
      .select({ id: kurzy.id, nazev: kurzy.nazev })
      .from(kurzy)
      .where(eq(kurzy.tenantId, kdo.autoskola.id))
      .orderBy(asc(kurzy.nazev));

    // Všechno, co není jízda, je výuka — teorie, údržba i zdravotnická
    // příprava. Vyjmenovávat druhy by znamenalo, že na nový druh se
    // jednou zapomene a ze sestavy tiše vypadne.
    const seznam = await tx
      .select({ t: terminy, ucitel: ucitele, kurz: kurzy })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .leftJoin(kurzy, eq(kurzy.id, terminy.kurzId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          ne(terminy.druh, "jizda"),
          ne(terminy.stav, "zruseno"),
          gte(terminy.zacatek, zacatek),
          lte(terminy.zacatek, konec),
          kurzId ? eq(terminy.kurzId, kurzId) : undefined,
        ),
      )
      .orderBy(asc(terminy.zacatek));

    const idcka = seznam.map((x) => x.t.id);

    const ucastnici =
      idcka.length === 0
        ? []
        : await tx
            .select({
              terminId: ucast.terminId,
              pritomen: ucast.pritomen,
              evidencniCislo: vycviky.evidencniCislo,
              jmeno: zaci.jmeno,
              prijmeni: zaci.prijmeni,
            })
            .from(ucast)
            .innerJoin(vycviky, eq(vycviky.id, ucast.vycvikId))
            .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
            .where(
              and(eq(ucast.tenantId, kdo.autoskola.id), inArray(ucast.terminId, idcka)),
            )
            .orderBy(asc(zaci.prijmeni), asc(zaci.jmeno));

    return { kurzySeznam, seznam, ucastnici };
  });

  const { kurzySeznam, seznam, ucastnici } = data;

  const podleTerminu = new Map<string, { byli: string[]; nebyli: string[] }>();
  for (const u of ucastnici) {
    const zaznam = podleTerminu.get(u.terminId) ?? { byli: [], nebyli: [] };
    const jmeno = `${u.evidencniCislo} ${u.jmeno} ${u.prijmeni}`;
    (u.pritomen ? zaznam.byli : zaznam.nebyli).push(jmeno);
    podleTerminu.set(u.terminId, zaznam);
  }

  const hodinCelkem = seznam.reduce((s, x) => s + naHodiny(x.t.delkaMinut), 0);

  function predmet(klic: string | null, skupina: string | undefined) {
    if (!klic) return "—";
    const nalezeny = (PREDMETY[skupina ?? "B"] ?? []).find((x) => x.klic === klic);
    return nalezeny ? nalezeny.nazev : klic;
  }

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
          Třídní kniha{" "}
          <span className="font-normal text-neutral-500">
            {kdo.autoskola.nazev}
          </span>
        </h1>
        <p className="text-sm text-neutral-500">
          {formatDatum(r.od)} – {formatDatum(r.do)} · {seznam.length}{" "}
          {seznam.length === 1 ? "termín" : seznam.length < 5 ? "termíny" : "termínů"} ·{" "}
          {Math.round(hodinCelkem * 10) / 10} h
        </p>
      </div>

      <Obdobi
        cesta="/sestavy/tridni-kniha"
        rozsah={r}
        vybery={[
          {
            jmeno: "kurz",
            popis: "Kurz",
            hodnota: kurzId,
            moznosti: kurzySeznam.map((k) => ({ hodnota: k.id, popis: k.nazev })),
          },
        ]}
      />

      {seznam.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Ve vybraném období není zapsaná žádná výuka.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Datum</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Čas</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Hod.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Předmět</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Téma</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Učitel</th>
                <th className="py-2 text-xs font-medium text-neutral-500">Účast</th>
              </tr>
            </thead>
            <tbody>
              {seznam.map((x) => {
                const u = podleTerminu.get(x.t.id);
                const zapsana = x.t.stav === "probehlo";

                return (
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
                    <td className="py-1.5 pr-3 tabular-nums">
                      {naHodiny(x.t.delkaMinut)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {predmet(x.t.predmet, x.kurz?.skupina)}
                    </td>
                    <td className="py-1.5 pr-3">{x.t.tema ?? "—"}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3">
                      {x.ucitel ? `${x.ucitel.jmeno} ${x.ucitel.prijmeni}` : "—"}
                    </td>
                    <td className="py-1.5">
                      {!zapsana ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          docházka nezapsaná
                        </span>
                      ) : u && u.byli.length > 0 ? (
                        <>
                          {u.byli.join(", ")}
                          {u.nebyli.length > 0 ? (
                            <span className="block text-xs text-neutral-500">
                              nebyli: {u.nebyli.join(", ")}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-neutral-500">nikdo nebyl</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
