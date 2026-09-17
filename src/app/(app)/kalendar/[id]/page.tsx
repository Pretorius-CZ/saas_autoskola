import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucast, ucitele, vozidla, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { denAMesic, nazevDne, proAdresu, rozsah } from "@/lib/cas";
import { PREDMETY } from "@/lib/osnova";
import Dochazka from "./dochazka";
import StavTerminu from "./stav";

export const dynamic = "force-dynamic";

const DRUHY: Record<string, string> = {
  jizda: "Jízda",
  teorie: "Konzultace",
  udrzba: "Údržba",
  zdravotni: "Zdravotnická příprava",
};

export default async function DetailTerminu({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [z] = await tx
      .select({ t: terminy, ucitel: ucitele, vozidlo: vozidla, kurz: kurzy })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .leftJoin(kurzy, eq(kurzy.id, terminy.kurzId))
      .where(and(eq(terminy.id, id), eq(terminy.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!z) return null;

    // U jízdy koho se týká
    let zak: { id: string; evidencniCislo: number; jmeno: string; prijmeni: string } | null =
      null;
    if (z.t.vycvikId) {
      const [v] = await tx
        .select({
          id: vycviky.id,
          evidencniCislo: vycviky.evidencniCislo,
          jmeno: zaci.jmeno,
          prijmeni: zaci.prijmeni,
        })
        .from(vycviky)
        .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
        .where(eq(vycviky.id, z.t.vycvikId))
        .limit(1);
      zak = v ?? null;
    }

    // U konzultace složení kurzu a dosavadní docházka
    let seznam: {
      vycvikId: string;
      evidencniCislo: number;
      jmeno: string;
      prijmeni: string;
      pritomen: boolean;
    }[] = [];

    if (z.t.kurzId) {
      const clenove = await tx
        .select({
          vycvikId: vycviky.id,
          evidencniCislo: vycviky.evidencniCislo,
          jmeno: zaci.jmeno,
          prijmeni: zaci.prijmeni,
        })
        .from(vycviky)
        .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
        .where(and(eq(vycviky.tenantId, kdo.autoskola.id), eq(vycviky.kurzId, z.t.kurzId)))
        .orderBy(asc(zaci.prijmeni));

      const zapsana = await tx
        .select()
        .from(ucast)
        .where(and(eq(ucast.tenantId, kdo.autoskola.id), eq(ucast.terminId, id)));

      const podle = new Map(zapsana.map((u) => [u.vycvikId, u.pritomen]));
      seznam = clenove.map((c) => ({ ...c, pritomen: podle.get(c.vycvikId) ?? false }));
    }

    return { z, zak, seznam };
  });

  if (!data) notFound();

  const { z, zak, seznam } = data;
  const predmet = PREDMETY[z.kurz?.skupina ?? "B"]?.find((p) => p.klic === z.t.predmet);

  return (
    <main className="space-y-4">
      <div>
        <Link
          href={`/kalendar?tyden=${proAdresu(z.t.zacatek)}`}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Kalendář
        </Link>

        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">
            {DRUHY[z.t.druh] ?? z.t.druh}{" "}
            <span className="font-normal text-neutral-500">
              {nazevDne(z.t.zacatek)} {denAMesic(z.t.zacatek)}{" "}
              {rozsah(z.t.zacatek, z.t.delkaMinut)}
            </span>
          </h1>
          <StavTerminu id={z.t.id} stav={z.t.stav} />
        </div>

        <p className="mt-1 text-sm text-neutral-500">
          {[
            z.ucitel ? `${z.ucitel.jmeno} ${z.ucitel.prijmeni}` : null,
            z.vozidlo ? `${z.vozidlo.znacka} ${z.vozidlo.typ} · ${z.vozidlo.rz}` : null,
            z.kurz ? z.kurz.nazev : null,
            predmet?.nazev,
            z.t.misto,
            z.t.tema,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {zak ? (
          <p className="mt-1 text-sm">
            <Link href={`/zaci/${zak.id}`} className="underline-offset-4 hover:underline">
              <span className="tabular-nums text-neutral-500">{zak.evidencniCislo}</span>{" "}
              {zak.jmeno} {zak.prijmeni}
            </Link>
          </p>
        ) : null}
      </div>

      {z.t.kurzId ? (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Docházka
          </h2>
          {seznam.length === 0 ? (
            <p className="mt-1 text-sm text-neutral-500">
              V kurzu zatím nikdo není.{" "}
              <Link href="/kurzy" className="underline underline-offset-4">
                Přidat žáky
              </Link>
            </p>
          ) : (
            <Dochazka terminId={z.t.id} seznam={seznam} />
          )}
        </section>
      ) : null}
    </main>
  );
}
