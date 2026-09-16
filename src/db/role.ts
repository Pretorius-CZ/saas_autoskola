/**
 * Vytvoří pro aplikaci vlastní databázový účet s omezenými právy.
 *
 * Spouští se příkazem:  npm run db:role
 *
 * Proč to děláme:
 *   Výchozí účet od Neonu (neondb_owner) má oprávnění BYPASSRLS —
 *   ignoruje veškerá pravidla o tom, kdo smí vidět který řádek.
 *   Dokud se aplikace připojuje jím, je izolace dat jen na papíře.
 *
 *   Nový účet umí číst a zapisovat řádky a nic víc. Nemůže založit
 *   ani zahodit tabulku a nemůže obejít pravidla.
 *
 * Vlastník zůstává na migrace (db:push), seed a zálohy.
 */

import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const ROLE = "autoskola_app";

const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Chybí DATABASE_URL_OWNER (ani DATABASE_URL). Zkontroluj .env.local.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  max: 1,
});

/**
 * Sestaví příkaz na straně databáze, aby se heslo ani název role
 * nedaly do příkazu propašovat jako kus SQL.
 */
async function bezpecnyPrikaz(vzor: string, ...hodnoty: string[]) {
  // format() sestaví příkaz uvnitř databáze: %I ošetří název, %L hodnotu.
  // Vzor i hodnoty posíláme jako parametry, takže se z nich nemůže
  // stát vykonatelný kus SQL.
  // ::text musí být uvedené — format() přijímá cokoli, takže by Postgres
  // typ parametru sám neuhodl a odmítl by dotaz.
  const dalsi = hodnoty.map((_, i) => `$${i + 2}::text`).join(", ");
  const { rows } = await pool.query<{ prikaz: string }>(
    `select format($1::text${dalsi ? ", " + dalsi : ""}) as prikaz`,
    [vzor, ...hodnoty],
  );
  return rows[0].prikaz;
}

async function main() {
  const { rows: kdo } = await pool.query<{
    current_user: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(`
    select current_user, r.rolsuper, r.rolbypassrls
    from pg_roles r where r.rolname = current_user
  `);

  console.log(
    `Připojen jako ${kdo[0].current_user} (obchází pravidla: ${kdo[0].rolbypassrls ? "ano" : "ne"}).`,
  );

  const heslo = randomBytes(24).toString("base64url");

  const { rows: existuje } = await pool.query(
    "select 1 from pg_roles where rolname = $1",
    [ROLE],
  );

  if (existuje.length === 0) {
    const prikaz = await bezpecnyPrikaz(
      "create role %I with login password %L nobypassrls nosuperuser nocreatedb nocreaterole",
      ROLE,
      heslo,
    );
    await pool.query(prikaz);
    console.log(`Účet ${ROLE} vytvořen.`);
  } else {
    const prikaz = await bezpecnyPrikaz(
      "alter role %I with login password %L nobypassrls nosuperuser nocreatedb nocreaterole",
      ROLE,
      heslo,
    );
    await pool.query(prikaz);
    console.log(`Účet ${ROLE} už existoval — nastaveno nové heslo.`);
  }

  // Práva: číst a zapisovat řádky. Nic o zakládání a rušení tabulek.
  const grants = [
    `grant usage on schema public to "${ROLE}"`,
    `grant select, insert, update, delete on all tables in schema public to "${ROLE}"`,
    `grant usage, select on all sequences in schema public to "${ROLE}"`,
    `alter default privileges in schema public grant select, insert, update, delete on tables to "${ROLE}"`,
    `alter default privileges in schema public grant usage, select on sequences to "${ROLE}"`,
  ];
  for (const g of grants) await pool.query(g);
  console.log("Práva nastavena (čtení a zápis řádků, nic víc).");

  // Sestavíme připojovací řetězec: stejný server a databáze, jiný účet.
  const bezUdaju = url!.replace(/^postgresql:\/\/[^@]*@/, "postgresql://");
  const novy = bezUdaju.replace(
    "postgresql://",
    `postgresql://${ROLE}:${encodeURIComponent(heslo)}@`,
  );

  console.log("");
  console.log("Do .env.local dej tohle jako DATABASE_URL (aplikace):");
  console.log("");
  console.log(`DATABASE_URL="${novy}"`);
  console.log("");
  console.log("Heslo se znovu nezobrazí. Když ho ztratíš, spusť skript znovu —");
  console.log("vyrobí nové. Stejný řetězec patří i na Vercel.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
