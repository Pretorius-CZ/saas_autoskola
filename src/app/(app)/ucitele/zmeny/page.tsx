import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele, zmeny } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import HistorieTabulka from "@/components/historie-tabulka";
import { nactiNazvyOdkazu } from "@/lib/historie-data";

/**
 * Historie změn za všechny učitele dohromady.
 *
 * Schválně jedno místo, ne odkaz u každého řádku: učitelů je pár a zajímá tě, co
 * se v evidenci dělo, ne co se dělo zrovna u Nováka.
 */
export const dynamic = "force-dynamic";

export default async function ZmenyUcitelu() {
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const radky = await tx
      .select()
      .from(zmeny)
      .where(
        and(eq(zmeny.tenantId, kdo.autoskola.id), eq(zmeny.tabulka, "ucitele")),
      )
      .orderBy(desc(zmeny.kdy));

    // Jména se berou z dnešního stavu evidence, ne z historie. Když se
    // učitel přejmenuje, chceme v přehledu vidět, jak se jmenuje teď.
    const seznam = await tx
      .select()
      .from(ucitele)
      .where(eq(ucitele.tenantId, kdo.autoskola.id))
      .orderBy(asc(ucitele.prijmeni), asc(ucitele.jmeno));

    const { nazvy, lide } = await nactiNazvyOdkazu(tx, radky);

    return { radky, seznam, nazvy, lide };
  });

  const { radky, seznam, nazvy, lide } = data;

  const koho = new Map<string, string>();
  for (const z of seznam) koho.set(z.id, `${z.jmeno} ${z.prijmeni}`);

  return (
    <main className="space-y-4">
      <div>
        <Link
          href="/ucitele"
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Učitelé
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">Historie změn — učitelé</h1>
          <p className="text-xs text-neutral-500">
            {radky.length}{" "}
            {radky.length === 1
              ? "záznam"
              : radky.length < 5
                ? "záznamy"
                : "záznamů"}
          </p>
        </div>
      </div>

      <HistorieTabulka radky={radky} nazvy={nazvy} lide={lide} koho={koho} />

      <p className="text-xs text-neutral-500">
        Záznamy do historie zapisuje databáze sama a nejdou upravit ani smazat.
      </p>
    </main>
  );
}
