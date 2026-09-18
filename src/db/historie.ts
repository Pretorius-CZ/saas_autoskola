/**
 * Zapne zaznamenávání změn v evidenci.
 *
 * Spouští se příkazem:  npm run db:historie
 * Pouštěj ho po každém db:push, který přidal tabulku s evidencí.
 *
 * Proč takhle a ne v kódu aplikace:
 *   Kdybych zápis do historie psal do každé akce zvlášť, dřív nebo později
 *   přidám novou obrazovku a zapomenu ho tam dát. V evidenci by vznikla
 *   díra, o které by nikdo nevěděl. Pravidlo v databázi se spustí vždycky —
 *   i při změně provedené úplně mimo aplikaci.
 */

import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

// Tabulky, jejichž změny se zaznamenávají. Novou tabulku s evidencí
// přidej sem ve stejnou chvíli, kdy ji přidáš do schema.ts.
const TABULKY = [
  "tenants",
  "ucitele",
  "vozidla",
  "zaci",
  "vycviky",
  "kurzy",
  "terminy",
  "ucast",
  "poznamky_kurzu",
  "pozvanky",
];

const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Chybí DATABASE_URL_OWNER. Zkontroluj .env.local.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  max: 1,
});

const FUNKCE = `
create or replace function zaznamenej_zmenu() returns trigger
language plpgsql
as $$
declare
  klic text;
  stary jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  novy  jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  autoskola uuid;
  zaznam uuid;
  kdo text := nullif(current_setting('app.uzivatel_id', true), '');
  -- Hodnoty těchto sloupců se do historie NEPÍŠOU. Zaznamená se jen to,
  -- že se změnily. Historie nesmí být místem, kde leží rodné číslo čitelně.
  citliva text[] := array['rodne_cislo_sifr', 'logo_data'];
  -- Technické sloupce, jejichž změna nic neříká.
  vynechat text[] := array['created_at', 'updated_at'];
begin
  autoskola := coalesce((novy->>'tenant_id')::uuid, (stary->>'tenant_id')::uuid);
  zaznam := coalesce((novy->>'id')::uuid, (stary->>'id')::uuid);

  -- U tabulky autoškol je autoškolou sám záznam.
  if autoskola is null then
    autoskola := zaznam;
  end if;

  if tg_op = 'UPDATE' then
    for klic in select jsonb_object_keys(novy) loop
      if klic = any(vynechat) then
        continue;
      end if;
      if (stary->>klic) is distinct from (novy->>klic) then
        insert into zmeny (tenant_id, tabulka, zaznam_id, akce, pole, hodnota_pred, hodnota_po, uzivatel_id)
        values (
          autoskola, tg_table_name, zaznam, 'zmena', klic,
          case when klic = any(citliva) then '•••' else stary->>klic end,
          case when klic = any(citliva) then '•••' else novy->>klic end,
          kdo
        );
      end if;
    end loop;
  elsif tg_op = 'INSERT' then
    insert into zmeny (tenant_id, tabulka, zaznam_id, akce, uzivatel_id)
    values (autoskola, tg_table_name, zaznam, 'vznik', kdo);
  else
    insert into zmeny (tenant_id, tabulka, zaznam_id, akce, uzivatel_id)
    values (autoskola, tg_table_name, zaznam, 'smazani', kdo);
  end if;

  return null;
end;
$$;
`;

const NEMENNOST = `
create or replace function zmeny_jsou_nemenne() returns trigger
language plpgsql
as $$
begin
  raise exception 'Záznam o změně nelze upravit ani smazat.';
end;
$$;
`;

async function main() {
  await pool.query(FUNKCE);
  await pool.query(NEMENNOST);
  console.log("Pravidla připravena.");

  for (const t of TABULKY) {
    await pool.query(`drop trigger if exists "zaznam_zmen" on "${t}"`);
    await pool.query(`
      create trigger "zaznam_zmen"
        after insert or update or delete on "${t}"
        for each row execute function zaznamenej_zmenu()
    `);
    console.log(`Zaznamenávám změny v tabulce ${t}.`);
  }

  // Historii nesmí nikdo přepsat ani smazat — ani aplikace, ani já.
  await pool.query(`drop trigger if exists "zmeny_bez_uprav" on "zmeny"`);
  await pool.query(`
    create trigger "zmeny_bez_uprav"
      before update or delete on "zmeny"
      for each row execute function zmeny_jsou_nemenne()
  `);
  await pool.query(`revoke update, delete on "zmeny" from "autoskola_app"`);
  console.log("Historie je zamčená proti úpravám.");

  // --- ověření, že to opravdu drží -----------------------------------
  console.log("");
  console.log("Ověřuji:");

  const { rows: pocetPred } = await pool.query<{ p: number }>(
    "select count(*)::int as p from zmeny",
  );

  const { rows: autoskoly } = await pool.query("select id, nazev from tenants limit 1");
  if (autoskoly.length === 0) {
    console.log("  (v databázi zatím není žádná autoškola, zkoušku přeskakuji)");
  } else {
    const id = autoskoly[0].id as string;
    const nazev = autoskoly[0].nazev as string;

    await pool.query("update tenants set nazev = $1 where id = $2", [nazev + " ", id]);
    await pool.query("update tenants set nazev = $1 where id = $2", [nazev, id]);

    const { rows: pocetPo } = await pool.query<{ p: number }>(
      "select count(*)::int as p from zmeny",
    );
    const pribylo = pocetPo[0].p - pocetPred[0].p;
    console.log(
      pribylo === 2
        ? "  změna se zaznamenala (2 zápisy za 2 úpravy)"
        : `  POZOR: za dvě úpravy přibylo ${pribylo} zápisů`,
    );
  }

  try {
    await pool.query("update zmeny set pole = 'pokus' where true");
    console.log("  POZOR: historii se podařilo přepsat!");
    process.exitCode = 1;
  } catch {
    console.log("  historii nejde přepsat");
  }

  console.log("");
  console.log("Hotovo.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
