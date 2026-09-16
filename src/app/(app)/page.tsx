import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele, vozidla } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { dniDo, formatDatum } from "@/lib/datum";

export const dynamic = "force-dynamic";

// Kolik dní předem chceme vědět, že něco propadá.
const PREDSTIH_DNI = 60;

export default async function Prehled() {
  const kdo = await vyzadujPrihlaseni();
  // Obojí v jedné transakci — nastavení autoškoly platí jen uvnitř ní.
  const { u, v } = await proAutoskolu(kdo.autoskola.id, async (tx) => {
    const u = await tx
      .select()
      .from(ucitele)
      .where(and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.aktivni, true)));
    const v = await tx
      .select()
      .from(vozidla)
      .where(and(eq(vozidla.tenantId, kdo.autoskola.id), eq(vozidla.aktivni, true)));
    return { u, v };
  });

  // Co propadá nebo už propadlo. Jeden seznam, ne tři — zajímá tě,
  // co musíš řešit, ne v které tabulce to je.
  type Upozorneni = { kdo: string; co: string; datum: string | null; dni: number | null };
  const upozorneni: Upozorneni[] = [];

  for (const ucitel of u) {
    const jmeno = `${ucitel.jmeno} ${ucitel.prijmeni}`;
    const kontroly: [string, string | null][] = [
      ["profesní osvědčení", ucitel.osvedceniPlatnostDo],
      ["zdravotní způsobilost", ucitel.zdravotniZpusobilostDo],
    ];
    for (const [co, datum] of kontroly) {
      const dni = dniDo(datum);
      if (dni !== null && dni <= PREDSTIH_DNI) {
        upozorneni.push({ kdo: jmeno, co, datum, dni });
      }
    }
  }

  for (const vozidlo of v) {
    const dni = dniDo(vozidlo.stkDo);
    if (dni !== null && dni <= PREDSTIH_DNI) {
      upozorneni.push({
        kdo: `${vozidlo.znacka} ${vozidlo.typ} (${vozidlo.rz})`,
        co: "STK",
        datum: vozidlo.stkDo,
        dni,
      });
    }
  }

  upozorneni.sort((a, b) => (a.dni ?? 0) - (b.dni ?? 0));

  return (
    <main className="space-y-8">
      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/ucitele"
          className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <p className="text-3xl font-semibold tabular-nums">{u.length}</p>
          <p className="text-sm text-neutral-500">
            {u.length === 1 ? "učitel" : u.length < 5 ? "učitelé" : "učitelů"}
          </p>
        </Link>
        <Link
          href="/vozidla"
          className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <p className="text-3xl font-semibold tabular-nums">{v.length}</p>
          <p className="text-sm text-neutral-500">
            {v.length === 1 ? "vozidlo" : v.length < 5 ? "vozidla" : "vozidel"}
          </p>
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">
          Vyžaduje pozornost
        </h2>

        {upozorneni.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nic nepropadá v nejbližších {PREDSTIH_DNI} dnech.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {upozorneni.map((z, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                <span>
                  <span className="font-medium">{z.kdo}</span>
                  <span className="text-neutral-500"> — {z.co}</span>
                </span>
                <span
                  className={
                    (z.dni ?? 0) < 0
                      ? "whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400"
                      : "whitespace-nowrap text-sm text-amber-600 dark:text-amber-400"
                  }
                >
                  {(z.dni ?? 0) < 0
                    ? `propadlo ${formatDatum(z.datum)}`
                    : `za ${z.dni} dní · ${formatDatum(z.datum)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
