import { and, asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { dniDo, formatDatum } from "@/lib/datum";

export const dynamic = "force-dynamic";

function Platnost({ datum }: { datum: string | null }) {
  const dni = dniDo(datum);

  if (dni === null) {
    return <span className="text-neutral-400">nevyplněno</span>;
  }
  if (dni < 0) {
    return (
      <span className="font-medium text-red-600 dark:text-red-400">
        {formatDatum(datum)} · propadlo
      </span>
    );
  }
  if (dni <= 60) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {formatDatum(datum)} · za {dni} dní
      </span>
    );
  }
  return <span>{formatDatum(datum)}</span>;
}

export default async function Ucitele() {
  const kdo = await vyzadujPrihlaseni();
  // Podmínku na autoškolu píšeme dál, i když ji databáze hlídá sama.
  // Dva zámky na jedněch dveřích jsou levné; chybějící zámek ne.
  const seznam = await proAutoskolu(kdo.autoskola.id, (tx) =>
    tx
      .select()
      .from(ucitele)
      .where(eq(ucitele.tenantId, kdo.autoskola.id))
      .orderBy(asc(ucitele.prijmeni), asc(ucitele.jmeno)),
  );

  return (
    <main>
      <h1 className="text-lg font-semibold">Učitelé</h1>

      {seznam.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Zatím tu není nikdo.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {seznam.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-medium">
                  {u.jmeno} {u.prijmeni}
                  {u.aktivni ? null : (
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      neaktivní
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{u.skupiny ?? "—"}</p>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-neutral-500">Osvědčení</dt>
                  <dd>
                    {u.cisloOsvedceni ?? "—"}{" "}
                    <span className="text-neutral-400">·</span>{" "}
                    <Platnost datum={u.osvedceniPlatnostDo} />
                  </dd>
                </div>

                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-neutral-500">Zdravotní způsobilost</dt>
                  <dd>
                    <Platnost datum={u.zdravotniZpusobilostDo} />
                  </dd>
                </div>

                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-neutral-500">Kontakt</dt>
                  <dd>
                    {u.telefon ?? "—"}
                    {u.email ? (
                      <>
                        {" "}
                        <span className="text-neutral-400">·</span> {u.email}
                      </>
                    ) : null}
                  </dd>
                </div>

                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-neutral-500">Účet</dt>
                  <dd className="tabular-nums">{u.bankovniUcet ?? "—"}</dd>
                </div>
              </dl>

              {u.poznamka ? (
                <p className="mt-3 text-sm text-neutral-500">{u.poznamka}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
