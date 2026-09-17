import { and, asc, eq, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import KurzFormulare from "./formulare";

export const dynamic = "force-dynamic";

export default async function Kurzy() {
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const seznam = await tx
      .select()
      .from(kurzy)
      .where(eq(kurzy.tenantId, kdo.autoskola.id))
      .orderBy(asc(kurzy.nazev));

    const zaciSeznam = await tx
      .select({
        id: vycviky.id,
        evidencniCislo: vycviky.evidencniCislo,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
        skupina: vycviky.skupina,
        kurzId: vycviky.kurzId,
      })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.tenantId, kdo.autoskola.id), ne(vycviky.stav, "zruseno")))
      .orderBy(asc(zaci.prijmeni));

    return { seznam, zaciSeznam };
  });

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Kurzy</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Kurz je skupina, která spolu chodí na teorii. Jízdy jsou individuální
          a ke kurzu nepatří.
        </p>
      </div>

      <KurzFormulare kurzy={data.seznam.map((k) => ({
        id: k.id,
        nazev: k.nazev,
        skupina: k.skupina,
        datumZahajeni: k.datumZahajeni ? formatDatum(k.datumZahajeni) : null,
        poznamka: k.poznamka,
      }))} zaci={data.zaciSeznam} />
    </main>
  );
}
