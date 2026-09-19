import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { Prihlaseny } from "@/lib/relace";

type Databaze = NonNullable<ReturnType<typeof getDb>>;
type Transakce = Parameters<Parameters<Databaze["transaction"]>[0]>[0];

/**
 * Jediná cesta, kterou se v aplikaci čtou a zapisují data autoškoly.
 *
 * Otevře transakci, řekne databázi, za koho se ptáme, a teprve pak pustí
 * dotazy. Databáze díky tomu sama odmítne vydat cokoli cizího — i kdybych
 * v dotazu zapomněl podmínku — a k případné změně si poznamená, kdo ji
 * udělal.
 *
 * Nastavení platí jen do konce transakce (proto to `true` na konci
 * set_config). Je to nutné: spojení se sdílí mezi požadavky a nastavení,
 * které by v něm zůstalo viset, by byl mnohem horší problém než ten,
 * který řešíme.
 */
export async function proAutoskolu<T>(
  kdo: Prihlaseny | string,
  prace: (tx: Transakce) => Promise<T>,
): Promise<T> {
  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");

  const tenantId = typeof kdo === "string" ? kdo : kdo.autoskola.id;
  const uzivatelId = typeof kdo === "string" ? "" : kdo.uzivatelId;

  return db.transaction(async (tx) => {
    // Obě nastavení jedním příkazem. Dřív to byly dva a každý stál jednu
    // cestu k databázi a zpátky. To je zadarmo, jen když je databáze
    // vedle; když je za oceánem, je to sto milisekund navíc pokaždé.
    await tx.execute(
      sql`select set_config('app.tenant_id', ${tenantId}, true),
                 set_config('app.uzivatel_id', ${uzivatelId}, true)`,
    );
    return prace(tx);
  });
}

/**
 * Čtení pro veřejný rozvrh žáka.
 *
 * Žák nemá účet, takže nemáme koho se zeptat, do které autoškoly patří.
 * Místo toho se databázi řekne token z odkazu a ta sama vydá jen to, co
 * k němu patří — jeden výcvik, jeho žáka a jeho termíny. I kdybych na
 * téhle stránce napsal dotaz špatně, cizí data z ní nevypadnou.
 *
 * Token musí být UUID: kdyby se do nastavení dostal jiný text, databáze
 * by na přetypování v pravidle spadla a chyba by vypadala záhadně.
 */
export function jeToken(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

export async function proRozvrh<T>(
  token: string,
  prace: (tx: Transakce) => Promise<T>,
): Promise<T> {
  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");
  if (!jeToken(token)) throw new Error("Neplatný odkaz.");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.rozvrh_token', ${token}, true)`);
    return prace(tx);
  });
}

/**
 * Práce jménem autoškoly, když nemáme přihlášeného uživatele.
 *
 * Používá se při vyzvednutí pozvánky: v tu chvíli se zakládá účet a
 * zapisuje se do evidence, ale nikdo přihlášený ještě není. Kdo to
 * udělal, se do historie zapíše až v okamžiku, kdy účet existuje.
 */
export async function proAutoskoluJako<T>(
  tenantId: string,
  uzivatelId: string,
  prace: (tx: Transakce) => Promise<T>,
): Promise<T> {
  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");

  return db.transaction(async (tx) => {
    // Obě nastavení jedním příkazem. Dřív to byly dva a každý stál jednu
    // cestu k databázi a zpátky. To je zadarmo, jen když je databáze
    // vedle; když je za oceánem, je to sto milisekund navíc pokaždé.
    await tx.execute(
      sql`select set_config('app.tenant_id', ${tenantId}, true),
                 set_config('app.uzivatel_id', ${uzivatelId}, true)`,
    );
    return prace(tx);
  });
}

/**
 * Čtení pozvánky podle odkazu.
 *
 * Stránka s pozvánkou běží bez přihlášení. Databázi se řekne otisk
 * odkazu a ta vydá jen tu jednu pozvánku a učitele, kterému patří —
 * i kdyby byl dotaz níž napsaný špatně.
 */
export async function proPozvanku<T>(
  otisk: string,
  prace: (tx: Transakce) => Promise<T>,
): Promise<T> {
  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.pozvanka', ${otisk}, true)`);
    return prace(tx);
  });
}
