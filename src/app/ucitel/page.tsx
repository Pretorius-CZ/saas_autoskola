import { and, asc, eq, gte, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucitele, vozidla, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { nazevDne, rozsah } from "@/lib/cas";
import { PREDMETY } from "@/lib/osnova";

/**
 * Moje termíny.
 *
 * Učitel vidí svoje, a jen svoje — dotaz se ptá na jeho identifikátor.
 * Ukazuje se ode dneška od půlnoci: ráno má být vidět i to, co bylo
 * v osm, protože se k tomu ještě zapisuje docházka.
 */
export const dynamic = "force-dynamic";

export default async function MojeTerminy() {
  const kdo = await vyzadujPrihlaseni();

  const dnesekOdPulnoci = new Date();
  dnesekOdPulnoci.setHours(0, 0, 0, 0);

  const data = await proAutoskolu(kdo, async (tx) => {
    const [ucitel] = await tx
      .select()
      .from(ucitele)
      .where(
        and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.userId, kdo.uzivatelId)),
      )
      .limit(1);

    if (!ucitel) return null;

    const seznam = await tx
      .select({
        t: terminy,
        kurz: kurzy,
        vozidlo: vozidla,
        evidencniCislo: vycviky.evidencniCislo,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
      })
      .from(terminy)
      .leftJoin(kurzy, eq(kurzy.id, terminy.kurzId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .leftJoin(vycviky, eq(vycviky.id, terminy.vycvikId))
      .leftJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          eq(terminy.ucitelId, ucitel.id),
          ne(terminy.stav, "zruseno"),
          gte(terminy.zacatek, dnesekOdPulnoci),
        ),
      )
      .orderBy(asc(terminy.zacatek));

    return { ucitel, seznam };
  });

  if (!data) {
    return (
      <main>
        <h1 className="text-lg font-semibold">Moje termíny</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tvůj účet zatím není propojený s učitelem v evidenci. Řekni o tom
          správci autoškoly — propojení dělá on na stránce Učitelé.
        </p>
      </main>
    );
  }

  const { seznam } = data;

  // Seskupení po dnech. Učitel přemýšlí ve dnech, ne v seznamu termínů.
  const dny = new Map<string, typeof seznam>();
  for (const x of seznam) {
    const klic = x.t.zacatek.toLocaleDateString("cs-CZ");
    dny.set(klic, [...(dny.get(klic) ?? []), x]);
  }

  function popis(x: (typeof seznam)[number]): string {
    if (x.t.druh === "jizda") {
      return x.jmeno ? `Jízda — ${x.jmeno} ${x.prijmeni}` : "Jízda";
    }
    const predmet = (PREDMETY[x.kurz?.skupina ?? "B"] ?? []).find(
      (p) => p.klic === x.t.predmet,
    );
    return predmet ? `Konzultace: ${predmet.nazev}` : "Konzultace";
  }

  return (
    <main>
      <h1 className="text-lg font-semibold">Moje termíny</h1>

      {seznam.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          Od dneška nemáš nic naplánovaného.
        </p>
      ) : (
        <div className="mt-3 space-y-5">
          {[...dny.entries()].map(([den, terminyDne]) => (
            <section key={den}>
              <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                {nazevDne(terminyDne[0].t.zacatek)} {den}
              </h2>

              <ul className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
                {terminyDne.map((x) => (
                  <li key={x.t.id} className="py-2.5">
                    <p className="text-sm">
                      <span className="tabular-nums font-medium">
                        {rozsah(x.t.zacatek, x.t.delkaMinut)}
                      </span>
                      {x.t.stav === "probehlo" ? (
                        <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                          proběhlo
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm font-medium">{popis(x)}</p>
                    <p className="text-xs text-neutral-500">
                      {[
                        x.t.druh === "jizda" && x.evidencniCislo
                          ? `č. ${x.evidencniCislo}`
                          : x.kurz?.nazev,
                        x.vozidlo ? `${x.vozidlo.znacka} ${x.vozidlo.rz}` : null,
                        x.t.misto,
                        x.t.tema,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        Zapisování docházky a podpisy sem přibudou v dalším kroku.
      </p>
    </main>
  );
}
