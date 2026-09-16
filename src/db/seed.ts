/**
 * Naplní prázdnou databázi tím, s čím se dá začít pracovat:
 * jedna autoškola, čtyři učitelé, čtyři vozidla.
 *
 * Spouští se příkazem:  npm run db:seed
 *
 * Je bezpečné ho pustit víckrát — co už existuje, nechá být.
 * Záměrně nemá vlastní importy přes "@/..." , aby šel spustit
 * i mimo Next.js.
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, isNull, sql } from "drizzle-orm";
import { tenants, ucitele, users, vozidla } from "./schema";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Chybí DATABASE_URL. Zkontroluj .env.local.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  max: 1,
});
const db = drizzle(pool, { schema: { tenants, ucitele, users, vozidla } });

/** Datum o zadaný počet dní od dneška, ve tvaru "2027-03-14". */
function zaDni(dni: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dni);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // --- autoškola ------------------------------------------------------------
  let [autoskola] = await db.select().from(tenants).limit(1);

  if (!autoskola) {
    [autoskola] = await db
      .insert(tenants)
      .values({
        // Zástupné údaje. Přepiš si je v aplikaci v Nastavení.
        nazev: "Moje autoškola",
        ico: "00000000",
        cisloRegistrace: "doplnit",
        orpPodani: "doplnit",
        ulice: "doplnit",
        mesto: "doplnit",
        psc: "00000",
        email: "doplnit@example.com",
        telefon: "+420000000000",
      })
      .returning();
    console.log("Založena autoškola:", autoskola.nazev);
  } else {
    console.log("Autoškola už existuje:", autoskola.nazev);
  }

  // --- přiřazení účtů, které ještě nikam nepatří -----------------------------
  const [{ pocet }] = await db
    .select({ pocet: sql<number>`count(*)::int` })
    .from(users);

  const osirele = await db.select().from(users).where(isNull(users.tenantId));

  for (const u of osirele) {
    // První účet v systému je správce. Další zakládá on sám.
    const role = pocet === 1 ? "spravce" : "ucitel";
    await db
      .update(users)
      .set({ tenantId: autoskola.id, role })
      .where(eq(users.id, u.id));
    console.log(`Účet ${u.email} přiřazen k autoškole jako ${role}.`);
  }

  // --- učitelé --------------------------------------------------------------
  // Od zapnutí izolace (npm run db:rls) platí, že bez nastavené autoškoly
  // databáze nevydá ani nepřijme řádek. Proto i seed pracuje v transakci
  // s nastaveným app.tenant_id — jinak by nic neviděl a zakládal by pořád dokola.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${autoskola.id}, true)`);

  const [{ pocetUcitelu }] = await tx
    .select({ pocetUcitelu: sql<number>`count(*)::int` })
    .from(ucitele);

  if (pocetUcitelu === 0) {
    await tx.insert(ucitele).values([
      {
        tenantId: autoskola.id,
        jmeno: "Petr",
        prijmeni: "Vávra",
        email: "vavra@example.com",
        telefon: "+420601111111",
        cisloOsvedceni: "UC-2024-0141",
        osvedceniPlatnostDo: zaDni(640),
        zdravotniZpusobilostDo: zaDni(410),
        skupiny: "B, B+E",
        bankovniUcet: "1234567890/0300",
      },
      {
        tenantId: autoskola.id,
        jmeno: "Jana",
        prijmeni: "Nováková",
        email: "novakova@example.com",
        telefon: "+420602222222",
        cisloOsvedceni: "UC-2023-0092",
        // schválně brzy propadá, ať je hned vidět, jak hlídání vypadá
        osvedceniPlatnostDo: zaDni(38),
        zdravotniZpusobilostDo: zaDni(300),
        skupiny: "B",
        bankovniUcet: "2345678901/0800",
      },
      {
        tenantId: autoskola.id,
        jmeno: "Tomáš",
        prijmeni: "Kubíček",
        email: "kubicek@example.com",
        telefon: "+420603333333",
        cisloOsvedceni: "UC-2025-0233",
        osvedceniPlatnostDo: zaDni(980),
        // tahle už propadla
        zdravotniZpusobilostDo: zaDni(-12),
        skupiny: "B, AM, A1",
        bankovniUcet: "3456789012/2010",
        poznamka: "Jezdí hlavně odpoledne.",
      },
      {
        tenantId: autoskola.id,
        jmeno: "Lenka",
        prijmeni: "Horáková",
        email: "horakova@example.com",
        telefon: "+420604444444",
        cisloOsvedceni: "UC-2024-0188",
        osvedceniPlatnostDo: zaDni(520),
        zdravotniZpusobilostDo: zaDni(150),
        skupiny: "B, B96",
        bankovniUcet: "4567890123/5500",
      },
    ]);
    console.log("Založeni 4 učitelé.");
  } else {
    console.log(`Učitelé už existují (${pocetUcitelu}), nechávám být.`);
  }

  // --- vozidla --------------------------------------------------------------
  const [{ pocetVozidel }] = await tx
    .select({ pocetVozidel: sql<number>`count(*)::int` })
    .from(vozidla);

  if (pocetVozidel === 0) {
    await tx.insert(vozidla).values([
      {
        tenantId: autoskola.id,
        znacka: "Škoda",
        typ: "Fabia",
        rz: "1AB 2345",
        skupina: "B",
        stkDo: zaDni(420),
      },
      {
        tenantId: autoskola.id,
        znacka: "Škoda",
        typ: "Octavia",
        rz: "2CD 6789",
        skupina: "B",
        // propadá za chvíli
        stkDo: zaDni(21),
      },
      {
        tenantId: autoskola.id,
        znacka: "Volkswagen",
        typ: "Caddy",
        rz: "3EF 1011",
        skupina: "B+E",
        stkDo: zaDni(200),
        poznamka: "Tahá přívěs pro B+E.",
      },
      {
        tenantId: autoskola.id,
        znacka: "Hyundai",
        typ: "i20",
        rz: "4GH 1213",
        skupina: "B",
        stkDo: null,
        poznamka: "STK zatím nevyplněno.",
      },
    ]);
    console.log("Založena 4 vozidla.");
  } else {
    console.log(`Vozidla už existují (${pocetVozidel}), nechávám být.`);
  }
  });

  console.log("Hotovo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
