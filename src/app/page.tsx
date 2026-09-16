import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";

// Stránka se nesmí cachovat — jinak by ukazovala stav databáze z doby sestavení.
export const dynamic = "force-dynamic";

type Stav = { ok: boolean; popis: string; detail?: string };

async function zjistiStav(): Promise<Stav[]> {
  const stavy: Stav[] = [
    { ok: true, popis: "Aplikace běží", detail: `prostředí: ${process.env.NODE_ENV}` },
  ];

  const db = getDb();

  if (!db) {
    stavy.push({
      ok: false,
      popis: "DATABASE_URL není nastavená",
      detail: "Vytvoř .env.local podle .env.example",
    });
    return stavy;
  }

  stavy.push({ ok: true, popis: "DATABASE_URL je nastavená" });

  try {
    const zacatek = Date.now();
    await db.execute(sql`select 1`);
    stavy.push({
      ok: true,
      popis: "Databáze odpovídá",
      detail: `${Date.now() - zacatek} ms`,
    });
  } catch (e) {
    stavy.push({
      ok: false,
      popis: "Databáze neodpovídá",
      detail: e instanceof Error ? e.message : String(e),
    });
    return stavy;
  }

  try {
    const [row] = await db
      .select({ pocet: sql<number>`count(*)::int` })
      .from(tenants);
    stavy.push({
      ok: true,
      popis: "Migrace proběhly",
      detail: `tabulka tenants existuje, záznamů: ${row?.pocet ?? 0}`,
    });
  } catch {
    stavy.push({
      ok: false,
      popis: "Migrace neproběhly",
      detail: "Spusť npm run db:push",
    });
  }

  return stavy;
}

export default async function Page() {
  const stavy = await zjistiStav();
  const vseOk = stavy.every((s) => s.ok);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-5 py-16">
      <header className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded bg-blue-700 text-lg font-bold text-white">
          L
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Autoškola</h1>
          <p className="text-sm text-neutral-500">Stav systému</p>
        </div>
      </header>

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
        {stavy.map((s) => (
          <li key={s.popis} className="flex items-start gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                s.ok ? "bg-emerald-600" : "bg-red-600"
              }`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.popis}</span>
              {s.detail ? (
                <span className="block break-words font-mono text-xs text-neutral-500">
                  {s.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-neutral-500">
        {vseOk
          ? "První týden je hotový. Zbývá ověřit zálohu a můžeme na druhý."
          : "Zatím nesedí všechno — postup je v souboru README.md."}
      </p>
    </main>
  );
}
