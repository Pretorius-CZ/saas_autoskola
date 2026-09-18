import Link from "next/link";
import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, vycviky } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { naHodiny } from "@/lib/osnova";
import Obdobi, { okamziky, rozsahZAdresy } from "../obdobi";

/**
 * Rozcestník třídních knih.
 *
 * Třídní kniha se vede po kurzech — do kurzu chodí konkrétní zařazení
 * lidé a to je přesně to, co má být na jejím začátku vypsané. Jeden
 * společný seznam všech konzultací by byl přehled, ne třídní kniha.
 */
export const dynamic = "force-dynamic";

export default async function TridniKnihy({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const kdo = await vyzadujPrihlaseni();

  const r = rozsahZAdresy(p);
  const { zacatek, konec } = okamziky(r);
  const dotaz = `?od=${r.od}&do=${r.do}`;

  const data = await proAutoskolu(kdo, async (tx) => {
    const seznam = await tx
      .select()
      .from(kurzy)
      .where(eq(kurzy.tenantId, kdo.autoskola.id))
      .orderBy(asc(kurzy.nazev));

    const zaci = await tx
      .select({ kurzId: vycviky.kurzId })
      .from(vycviky)
      .where(eq(vycviky.tenantId, kdo.autoskola.id));

    // Výuka je všechno, co není jízda. Vyjmenovávat druhy by znamenalo,
    // že na nový druh se jednou zapomene a tiše vypadne.
    const vyuka = await tx
      .select({
        kurzId: terminy.kurzId,
        delkaMinut: terminy.delkaMinut,
      })
      .from(terminy)
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          ne(terminy.druh, "jizda"),
          ne(terminy.stav, "zruseno"),
          gte(terminy.zacatek, zacatek),
          lte(terminy.zacatek, konec),
        ),
      );

    const mimoKurz = await tx
      .select({ id: terminy.id })
      .from(terminy)
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          ne(terminy.druh, "jizda"),
          ne(terminy.stav, "zruseno"),
          isNull(terminy.kurzId),
          gte(terminy.zacatek, zacatek),
          lte(terminy.zacatek, konec),
        ),
      );

    return { seznam, zaci, vyuka, mimoKurz };
  });

  const { seznam, zaci, vyuka, mimoKurz } = data;

  const pocetZaku = new Map<string, number>();
  for (const z of zaci) {
    if (!z.kurzId) continue;
    pocetZaku.set(z.kurzId, (pocetZaku.get(z.kurzId) ?? 0) + 1);
  }

  const hodin = new Map<string, number>();
  const terminu = new Map<string, number>();
  for (const v of vyuka) {
    if (!v.kurzId) continue;
    hodin.set(v.kurzId, (hodin.get(v.kurzId) ?? 0) + naHodiny(v.delkaMinut));
    terminu.set(v.kurzId, (terminu.get(v.kurzId) ?? 0) + 1);
  }

  return (
    <main className="space-y-4">
      <div>
        <Link
          href="/sestavy"
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Sestavy
        </Link>
        <h1 className="mt-1 text-lg font-semibold">Třídní knihy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Každý kurz má vlastní třídní knihu se seznamem zařazených žáků.
          Vyber kurz.
        </p>
      </div>

      <Obdobi cesta="/sestavy/tridni-kniha" rozsah={r} />

      {seznam.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Zatím není založený žádný kurz.
        </p>
      ) : (
        <ul className="space-y-3">
          {seznam.map((k) => (
            <li
              key={k.id}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link
                  href={`/sestavy/tridni-kniha/${k.id}${dotaz}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {k.nazev}
                </Link>
                <p className="text-sm text-neutral-500">
                  skupina {k.skupina}
                  {k.datumZahajeni ? ` · od ${formatDatum(k.datumZahajeni)}` : ""}
                  {k.aktivni ? "" : " · neaktivní"}
                </p>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {pocetZaku.get(k.id) ?? 0} žáků · ve vybraném období{" "}
                {terminu.get(k.id) ?? 0} termínů,{" "}
                {Math.round((hodin.get(k.id) ?? 0) * 10) / 10} h
              </p>
            </li>
          ))}
        </ul>
      )}

      {mimoKurz.length > 0 ? (
        <div className="rounded-xl border border-amber-300 p-4 dark:border-amber-800">
          <Link
            href={`/sestavy/tridni-kniha/bez-kurzu${dotaz}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            Výuka mimo kurz
          </Link>
          <p className="mt-1 text-sm text-neutral-500">
            {mimoKurz.length} termínů ve vybraném období nemá přiřazený kurz,
            takže u nich nejde vést docházku. Patří do některé třídní knihy —
            oprav jim kurz v kalendáři.
          </p>
        </div>
      ) : null}
    </main>
  );
}
