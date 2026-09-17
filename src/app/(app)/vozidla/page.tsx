import { asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vozidla } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { dniDo, formatDatum } from "@/lib/datum";

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
      <h1 className="text-lg font-semibold">Vozidla</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Úřad eviduje značku, typ a registrační značku. STK je navíc — tu si
        hlídáš ty.
      </p>

      {seznam.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Zatím tu není nic.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {seznam.map((v) => {
            const dni = dniDo(v.stkDo);
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium">
                    {v.znacka} {v.typ}
                    {v.aktivni ? null : (
                      <span className="ml-2 text-sm font-normal text-neutral-500">
                        neaktivní
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-neutral-500">
                    <span className="tabular-nums">{v.rz}</span> · skupina{" "}
                    {v.skupina}
                  </p>
                </div>

                <p className="text-sm">
                  <span className="text-neutral-500">STK </span>
                  {dni === null ? (
                    <span className="text-neutral-400">nevyplněno</span>
                  ) : dni < 0 ? (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      propadla {formatDatum(v.stkDo)}
                    </span>
                  ) : dni <= 60 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatDatum(v.stkDo)} · za {dni} dní
                    </span>
                  ) : (
                    <span>{formatDatum(v.stkDo)}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
