import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { naleha, spocitejLhuty } from "@/lib/lhuty";

export const dynamic = "force-dynamic";

const STAVY: Record<string, string> = {
  zadost: "žádost podána",
  vycvik: "ve výcviku",
  ukonceno: "výcvik ukončen",
  zkousky: "u zkoušek",
  dokonceno: "dokončeno",
  zruseno: "zrušeno",
};

export default async function Zaci() {
  const kdo = await vyzadujPrihlaseni();

  const seznam = await proAutoskolu(kdo.autoskola.id, (tx) =>
    tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(eq(vycviky.tenantId, kdo.autoskola.id))
      .orderBy(desc(vycviky.evidencniCislo)),
  );

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold">Žáci</h1>
        <Link
          href="/zaci/novy"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Přijmout žáka
        </Link>
      </div>

      {seznam.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Zatím tu není nikdo. Prvního žáka přijmeš tlačítkem nahoře.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {seznam.map(({ v, z }) => {
            const upozorneni = naleha(spocitejLhuty(v));
            return (
              <li key={v.id}>
                <Link
                  href={`/zaci/${v.id}`}
                  className="block rounded-xl border border-neutral-200 p-4 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-medium">
                      <span className="tabular-nums text-neutral-500">
                        {v.evidencniCislo}
                      </span>{" "}
                      {z.jmeno} {z.prijmeni}
                    </p>
                    <p className="text-sm text-neutral-500">
                      skupina {v.skupina} · {STAVY[v.stav] ?? v.stav}
                    </p>
                  </div>

                  {upozorneni.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {upozorneni.map((l) => (
                        <li
                          key={l.klic}
                          className={
                            l.stav === "propadlo"
                              ? "text-sm font-medium text-red-600 dark:text-red-400"
                              : "text-sm text-amber-600 dark:text-amber-400"
                          }
                        >
                          {l.nazev} — {l.detail}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">
                      {v.datumZahajeni
                        ? `výcvik od ${formatDatum(v.datumZahajeni)}`
                        : `žádost ${formatDatum(v.datumPodaniZadosti)}`}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
