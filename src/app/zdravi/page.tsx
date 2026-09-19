import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sifrovaniFunguje } from "@/lib/sifrovani";
import { casovePasmo, env } from "@/lib/env";

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

  // Pásmo se měří, ne předpokládá. Když server počítá v UTC, uloží se
  // každý naplánovaný termín o dvě hodiny jinam a v aplikaci to vypadá
  // správně — pozná se to až na tom, co dostane žák do kalendáře.
  const pasmo = casovePasmo();
  stavy.push(
    pasmo === "Europe/Prague"
      ? { ok: true, popis: "Čas běží v českém pásmu", detail: pasmo }
      : {
          ok: false,
          popis: "Server počítá v jiném časovém pásmu — termíny se ukládají posunuté",
          detail: `${pasmo}, má být Europe/Prague`,
        },
  );

  const db = getDb();

  if (!db) {
    stavy.push({ ok: false, popis: "Připojení k databázi není nastavené" });
    return stavy;
  }

  try {
    const zacatek = Date.now();
    await db.execute(sql`select 1`);
    const ms = Date.now() - zacatek;

    // Na tomhle čísle stojí rychlost celé aplikace. Jedno otevření
    // stránky znamená několik cest k databázi a zpátky, takže se každá
    // milisekunda násobí. Do ~15 ms je databáze prakticky vedle; nad
    // 50 ms je skoro jistě v jiné části světa než aplikace a je to na
    // přesun jednoho nastavení, ne na přepisování kódu.
    const kdeBezime = env.VERCEL_REGION ? ` · aplikace běží v ${env.VERCEL_REGION}` : "";

    stavy.push(
      ms <= 15
        ? { ok: true, popis: "Databáze odpovídá rychle", detail: `${ms} ms${kdeBezime}` }
        : {
            ok: false,
            popis:
              ms > 50
                ? "Databáze odpovídá pomalu — nejspíš je v jiném regionu než aplikace"
                : "Databáze odpovídá pomaleji, než by měla",
            detail: `${ms} ms${kdeBezime}`,
          },
    );
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

  // Bez klíče nejde uložit rodné číslo. Aplikace jinak běží, ale přijetí
  // žáka by selhalo až ve chvíli uložení — a to je pozdě.
  stavy.push(
    sifrovaniFunguje()
      ? { ok: true, popis: "Šifrování citlivých údajů je nastavené" }
      : { ok: false, popis: "Chybí šifrovací klíč — rodná čísla nelze uložit" },
  );

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
