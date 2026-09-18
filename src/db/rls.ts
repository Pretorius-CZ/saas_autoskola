/**
 * Zapne v databázi izolaci po autoškolách (row level security)
 * a ověří ji tím účtem, kterým se připojuje aplikace.
 *
 * Spouští se příkazem:  npm run db:rls
 * Pouštěj ho po každém db:push, který přidal novou tabulku s tenant_id.
 *
 * Jak to funguje:
 *   Každá transakce si před dotazem nastaví proměnnou app.tenant_id.
 *   Databáze pak vydá jen řádky, které k té autoškole patří.
 *   Když proměnná nastavená není, nevydá NIC — mlčení znamená nic,
 *   ne všechno.
 */

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

// Tabulky, které mají sloupec tenant_id. Novou tabulku přidej sem
// ve stejnou chvíli, kdy ji přidáš do schema.ts.
const TABULKY = ["ucitele", "vozidla", "zaci", "vycviky", "kurzy", "terminy", "ucast", "zmeny"];

const urlVlastnik = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
const urlAplikace = process.env.DATABASE_URL;

if (!urlVlastnik) {
  console.error("Chybí DATABASE_URL_OWNER. Zkontroluj .env.local.");
  process.exit(1);
}

function spojeni(u: string) {
  return new Pool({
    connectionString: u,
    ssl: /localhost|127\.0\.0\.1/.test(u) ? undefined : { rejectUnauthorized: true },
    max: 1,
  });
}

const vlastnik = spojeni(urlVlastnik);
const aplikace = spojeni(urlAplikace!);

async function zapni(tabulka: string) {
  // FORCE vztáhne pravidla i na vlastníka tabulky. Nestačí to samo o sobě:
  // účet s oprávněním BYPASSRLS je ignoruje tak jako tak. Proto se aplikace
  // připojuje vlastním účtem bez toho oprávnění (viz npm run db:role).
  await vlastnik.query(`alter table "${tabulka}" enable row level security`);
  await vlastnik.query(`alter table "${tabulka}" force row level security`);
  await vlastnik.query(`drop policy if exists "izolace_autoskoly" on "${tabulka}"`);
  // nullif(..., '') je tady důležité: jakmile se proměnná v spojení
  // jednou nastaví, po skončení transakce se nevrací na "nenastaveno",
  // ale na prázdný řetězec. Bez tohohle ošetření by se ho databáze
  // pokusila číst jako identifikátor a dotaz by spadl.
  await vlastnik.query(`
    create policy "izolace_autoskoly" on "${tabulka}"
      using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  `);
  console.log(`Zapnuto pro tabulku ${tabulka}.`);
}

async function over(tabulka: string) {
  const klient = await aplikace.connect();
  try {
    // 1) bez nastavené autoškoly nesmí být vidět nic
    const bez = await klient.query(`select count(*)::int as pocet from "${tabulka}"`);
    if (bez.rows[0].pocet !== 0) {
      throw new Error(
        `${tabulka}: bez nastavené autoškoly je vidět ${bez.rows[0].pocet} řádků. Izolace NEFUNGUJE.`,
      );
    }

    // 2) s nastavenou autoškolou musí být vidět její řádky
    const { rows: autoskoly } = await vlastnik.query("select id from tenants limit 1");
    if (autoskoly.length === 0) {
      console.log(`${tabulka}: skryto bez kontextu (v databázi zatím není žádná autoškola).`);
      return;
    }

    await klient.query("begin");
    await klient.query("select set_config('app.tenant_id', $1, true)", [autoskoly[0].id]);
    const s = await klient.query(`select count(*)::int as pocet from "${tabulka}"`);
    await klient.query("commit");

    console.log(
      `${tabulka}: bez kontextu 0 řádků, s kontextem ${s.rows[0].pocet}. V pořádku.`,
    );
  } finally {
    klient.release();
  }
}

/**
 * Pravidla pro veřejný rozvrh žáka.
 *
 * Žák nemá účet. Do e-mailu dostane odkaz s tokenem a databáze podle něj
 * vydá jen jeho výcvik, jeho samotného a jeho termíny — nic víc. Kdyby
 * byla stránka rozvrhu napsaná špatně, cizí data z ní stejně nevypadnou.
 *
 * Pravidla jsou "permissive", takže se s izolací po autoškolách sčítají:
 * přihlášený uživatel vidí dál svoje, žák s odkazem vidí svůj rozvrh.
 */
const TOKEN = `nullif(current_setting('app.rozvrh_token', true), '')::uuid`;

async function zapniRozvrh() {
  await vlastnik.query(`drop policy if exists "rozvrh_vycvik" on "vycviky"`);
  await vlastnik.query(`
    create policy "rozvrh_vycvik" on "vycviky" for select
      using (token_rozvrhu = ${TOKEN})
  `);

  await vlastnik.query(`drop policy if exists "rozvrh_zak" on "zaci"`);
  await vlastnik.query(`
    create policy "rozvrh_zak" on "zaci" for select
      using (exists (
        select 1 from vycviky v
         where v.zak_id = zaci.id
           and v.token_rozvrhu = ${TOKEN}))
  `);

  // Jízdy visí na výcviku, teorie na kurzu. Žák má vidět obojí — pro něj
  // je to jeden rozvrh.
  await vlastnik.query(`drop policy if exists "rozvrh_termin" on "terminy"`);
  await vlastnik.query(`
    create policy "rozvrh_termin" on "terminy" for select
      using (exists (
        select 1 from vycviky v
         where v.token_rozvrhu = ${TOKEN}
           and (terminy.vycvik_id = v.id
                or (terminy.druh = 'teorie'
                    and v.kurz_id is not null
                    and terminy.kurz_id = v.kurz_id))))
  `);

  // Učitele smí žák vidět jen u termínů, které sám vidí. O tom, které to
  // jsou, rozhoduje pravidlo o řádek výš — ne tenhle dotaz.
  await vlastnik.query(`drop policy if exists "rozvrh_ucitel" on "ucitele"`);
  await vlastnik.query(`
    create policy "rozvrh_ucitel" on "ucitele" for select
      using (${TOKEN} is not null
             and exists (select 1 from terminy t where t.ucitel_id = ucitele.id))
  `);

  console.log("Zapnuto pravidlo pro veřejný rozvrh žáka.");
}

/**
 * Ověří, že odkaz na rozvrh ukáže jednoho žáka — a ne celou evidenci.
 * Bez tohohle měření je pravidlo jen dobrý úmysl.
 */
async function overRozvrh() {
  const { rows: vzorek } = await vlastnik.query(
    "select token_rozvrhu from vycviky limit 1",
  );
  if (vzorek.length === 0) {
    console.log("rozvrh: v databázi zatím není žádný výcvik, nemám co změřit.");
    return;
  }

  const { rows: vsichni } = await vlastnik.query("select count(*)::int as pocet from zaci");
  const token = vzorek[0].token_rozvrhu;

  const klient = await aplikace.connect();
  try {
    await klient.query("begin");
    await klient.query("select set_config('app.rozvrh_token', $1, true)", [token]);

    const v = await klient.query("select count(*)::int as pocet from vycviky");
    const z = await klient.query("select count(*)::int as pocet from zaci");
    const t = await klient.query("select count(*)::int as pocet from terminy");

    await klient.query("commit");

    if (v.rows[0].pocet !== 1 || z.rows[0].pocet !== 1) {
      throw new Error(
        `rozvrh: s odkazem je vidět ${v.rows[0].pocet} výcviků a ${z.rows[0].pocet} žáků. ` +
          "Mělo by být přesně po jednom.",
      );
    }

    console.log(
      `rozvrh: s odkazem 1 žák z ${vsichni[0].pocet} v evidenci, ` +
        `${t.rows[0].pocet} jeho termínů. V pořádku.`,
    );
  } finally {
    klient.release();
  }
}

async function main() {
  const { rows } = await aplikace.query<{ current_user: string; rolbypassrls: boolean }>(`
    select current_user, r.rolbypassrls
    from pg_roles r where r.rolname = current_user
  `);

  console.log(`Aplikace se připojuje jako: ${rows[0].current_user}`);

  if (rows[0].rolbypassrls) {
    console.error("");
    console.error(
      `Účet ${rows[0].current_user} má oprávnění BYPASSRLS — pravidla by ignoroval.`,
    );
    console.error("Spusť nejdřív: npm run db:role  a uprav DATABASE_URL podle jeho výpisu.");
    process.exit(1);
  }

  for (const t of TABULKY) await zapni(t);
  await zapniRozvrh();

  console.log("");
  console.log("Ověřuji účtem aplikace, že to opravdu drží:");
  for (const t of TABULKY) await over(t);
  await overRozvrh();

  console.log("");
  console.log("Hotovo.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await vlastnik.end();
    await aplikace.end();
  });
