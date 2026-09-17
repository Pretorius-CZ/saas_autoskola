import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/**
 * Veřejná stránka o stavu systému — schválně BEZ přihlášení.
 *
 * Když se rozbije přihlašování, je tohle jediné místo, kde se dá zjistit,
 * co se děje. Stavová stránka schovaná za přihlášením je k ničemu přesně
 * ve chvíli, kdy ji člověk potřebuje.
 *
 * Neukazuje žádná data — jen jestli aplikace běží a jestli databáze
 * odpovídá. Nic z toho nikomu nepomůže dostat se dovnitř.
 */
export const dynamic = "force-dynamic";

type Stav = { ok: boolean; popis: string; detail?: string };

async function zjistiStav(): Promise<Stav[]> {
  const stavy: Stav[] = [{ ok: true, popis: "Aplikace běží" }];

  const db = getDb();

  if (!db) {
    stavy.push({ ok: false, popis: "Připojení k databázi není nastavené" });
    return stavy;
  }

  try {
    const zacatek = Date.now();
    await db.execute(sql`select 1`);
    stavy.push({
      ok: true,
      popis: "Databáze odpovídá",
      detail: `${Date.now() - zacatek} ms`,
    });
  } catch {
    // Podrobnosti schválně neukazujeme — chybová hláška z databáze
    // umí prozradit víc, než je zdrávo. Celá je v Sentry.
    stavy.push({ ok: false, popis: "Databáze neodpovídá" });
    return stavy;
  }

  try {
    await db.execute(sql`select 1 from tenants limit 1`);
    stavy.push({ ok: true, popis: "Databáze je připravená" });
  } catch {
    stavy.push({ ok: false, popis: "Databáze není připravená" });
  }

  return stavy;
}

export default async function Zdravi() {
  const stavy = await zjistiStav();
  const vseOk = stavy.every((s) => s.ok);

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-lg font-semibold">Stav systému</h1>

      <ul className="mt-6 divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {stavy.map((s, i) => (
          <li key={i} className="flex items-baseline gap-3 px-4 py-3">
            <span
              className={
                s.ok
                  ? "mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500"
                  : "mt-1.5 size-2 shrink-0 rounded-full bg-red-500"
              }
            />
            <span>
              {s.popis}
              {s.detail ? (
                <span className="block text-sm text-neutral-500">{s.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-neutral-500">
        {vseOk
          ? "Systém běží. Když se ti přesto nedaří přihlásit, je chyba v e-mailu nebo heslu."
          : "Systém má potíže. Není to tvým heslem — zkus to prosím za chvíli."}
      </p>
    </main>
  );
}
