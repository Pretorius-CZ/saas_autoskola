import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, ne, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucitele, vycviky, zaci, zmeny } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { denAMesic, nazevDne, rozsah } from "@/lib/cas";
import { PREDMETY } from "@/lib/osnova";
import HistorieTabulka from "@/components/historie-tabulka";
import { nactiNazvyOdkazu } from "@/lib/historie-data";

export const dynamic = "force-dynamic";

export default async function KartaKurzu({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [kurz] = await tx
      .select()
      .from(kurzy)
      .where(and(eq(kurzy.id, id), eq(kurzy.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!kurz) return null;

    const clenove = await tx
      .select({
        id: vycviky.id,
        evidencniCislo: vycviky.evidencniCislo,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
        skupina: vycviky.skupina,
      })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.tenantId, kdo.autoskola.id), eq(vycviky.kurzId, id)))
      .orderBy(asc(zaci.prijmeni));

    const konzultace = await tx
      .select({ t: terminy, ucitel: ucitele })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          eq(terminy.kurzId, id),
          ne(terminy.stav, "zruseno"),
        ),
      )
      .orderBy(asc(terminy.zacatek));

    // Historie kurzu = změny samotného kurzu + přesuny žáků do něj a z něj.
    const historie = await tx
      .select()
      .from(zmeny)
      .where(
        and(
          eq(zmeny.tenantId, kdo.autoskola.id),
          or(
            eq(zmeny.zaznamId, id),
            and(eq(zmeny.pole, "kurz_id"), eq(zmeny.hodnotaPo, id)),
            and(eq(zmeny.pole, "kurz_id"), eq(zmeny.hodnotaPred, id)),
          ),
        ),
      )
      .orderBy(desc(zmeny.kdy));

    const { nazvy, lide } = await nactiNazvyOdkazu(tx, historie);

    return { kurz, clenove, konzultace, historie, nazvy, lide };
  });

  if (!data) notFound();

  const { kurz, clenove, konzultace, historie, nazvy, lide } = data;

  const predmety = PREDMETY[kurz.skupina] ?? [];
  const odbyto = new Map<string, number>();
  for (const k of konzultace) {
    if (k.t.zacatek.getTime() > Date.now()) continue;
    const klic = k.t.predmet ?? "?";
    odbyto.set(klic, (odbyto.get(klic) ?? 0) + 1);
  }

  return (
    <main className="space-y-4">
      <div>
        <Link href="/kurzy" className="text-xs text-neutral-500 underline-offset-4 hover:underline">
          ← Kurzy
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">{kurz.nazev}</h1>
          <p className="text-sm text-neutral-500">
            skupina {kurz.skupina}
            {kurz.datumZahajeni ? ` · od ${formatDatum(kurz.datumZahajeni)}` : ""}
            {kurz.aktivni ? "" : " · neaktivní"}
          </p>
        </div>
        {kurz.poznamka ? (
          <p className="mt-1 text-sm text-neutral-500">{kurz.poznamka}</p>
        ) : null}
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Žáci ({clenove.length})
        </h2>
        {clenove.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">Zatím tu není nikdo.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {clenove.map((c) => (
              <li key={c.id} className="text-sm">
                <Link href={`/zaci/${c.id}`} className="underline-offset-4 hover:underline">
                  <span className="tabular-nums text-neutral-500">{c.evidencniCislo}</span>{" "}
                  {c.jmeno} {c.prijmeni}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Konzultace
        </h2>

        {predmety.length > 0 ? (
          <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {predmety.map((p) => (
              <li key={p.klic} className="flex justify-between gap-3 text-sm">
                <span>{p.nazev}</span>
                <span className="tabular-nums text-neutral-500">
                  {odbyto.get(p.klic) ?? 0} odbyto
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {konzultace.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nic naplánovaného —{" "}
            <Link href="/kalendar" className="underline underline-offset-4">
              naplánovat
            </Link>
          </p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {konzultace.map((k) => (
              <li key={k.t.id} className="text-sm">
                <span className="text-neutral-500">{nazevDne(k.t.zacatek)} </span>
                <span className="tabular-nums">{denAMesic(k.t.zacatek)}</span>{" "}
                <span className="tabular-nums">{rozsah(k.t.zacatek, k.t.delkaMinut)}</span>
                <span className="text-neutral-500">
                  {" · "}
                  {predmety.find((p) => p.klic === k.t.predmet)?.nazev ?? "bez předmětu"}
                  {k.ucitel ? ` · ${k.ucitel.prijmeni}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Historie změn
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Včetně přesunů žáků do kurzu a z kurzu.
        </p>
        <div className="mt-2">
          <HistorieTabulka radky={historie} nazvy={nazvy} lide={lide} />
        </div>
      </section>
    </main>
  );
}
