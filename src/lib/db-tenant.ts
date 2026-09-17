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
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.uzivatel_id', ${uzivatelId}, true)`);
    return prace(tx);
  });
}
