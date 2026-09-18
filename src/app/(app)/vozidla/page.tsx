import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vozidla } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import SpravaVozidel from "./formulare";

export const dynamic = "force-dynamic";

export default async function Vozidla() {
  const kdo = await vyzadujPrihlaseni();

  const seznam = await proAutoskolu(kdo, (tx) =>
    tx
      .select()
      .from(vozidla)
      .where(eq(vozidla.tenantId, kdo.autoskola.id))
      .orderBy(asc(vozidla.znacka), asc(vozidla.typ)),
  );

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">Vozidla</h1>
        <Link href="/vozidla/zmeny" className="tlacitko-vedlejsi">
          Historie změn
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Úřad eviduje značku, typ a registrační značku. STK je navíc — tu si
        hlídáš ty. Vyřazené vozidlo se nemaže, jen označí jako neaktivní:
        je zapsané u jízd, které se odjely.
      </p>

      <SpravaVozidel
        seznam={seznam.map((v) => ({
          id: v.id,
          znacka: v.znacka,
          typ: v.typ,
          rz: v.rz,
          skupina: v.skupina,
          stkDo: v.stkDo,
          poznamka: v.poznamka,
          aktivni: v.aktivni,
        }))}
      />
    </main>
  );
}
