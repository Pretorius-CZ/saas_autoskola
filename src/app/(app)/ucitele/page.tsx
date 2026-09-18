import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import SpravaUcitelu from "./formulare";

export const dynamic = "force-dynamic";

export default async function Ucitele() {
  const kdo = await vyzadujPrihlaseni();

  // Podmínku na autoškolu píšeme dál, i když ji databáze hlídá sama.
  // Dva zámky na jedněch dveřích jsou levné; chybějící zámek ne.
  const seznam = await proAutoskolu(kdo, (tx) =>
    tx
      .select()
      .from(ucitele)
      .where(eq(ucitele.tenantId, kdo.autoskola.id))
      .orderBy(asc(ucitele.prijmeni), asc(ucitele.jmeno)),
  );

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">Učitelé</h1>
        <Link href="/ucitele/zmeny" className="tlacitko-vedlejsi">
          Historie změn
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Učitel se nemaže — je podepsaný pod termíny, které už proběhly. Kdo
        skončil, se označí jako neaktivní a přestane se nabízet při plánování.
      </p>

      <SpravaUcitelu
        seznam={seznam.map((u) => ({
          id: u.id,
          jmeno: u.jmeno,
          prijmeni: u.prijmeni,
          email: u.email,
          telefon: u.telefon,
          cisloOsvedceni: u.cisloOsvedceni,
          osvedceniPlatnostDo: u.osvedceniPlatnostDo,
          zdravotniZpusobilostDo: u.zdravotniZpusobilostDo,
          skupiny: u.skupiny,
          bankovniUcet: u.bankovniUcet,
          poznamka: u.poznamka,
          aktivni: u.aktivni,
        }))}
      />
    </main>
  );
}
