import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Používáme obyčejné postgresové spojení, ne ovladač specifický pro Neon.
 * Díky tomu půjde databázi kdykoli přestěhovat jinam bez zásahu do kódu —
 * a ten přesun v zadání MVP plánujeme před první cizí autoškolou.
 */
let pool: Pool | undefined;

export function getDb() {
  if (!env.DATABASE_URL) return null;

  if (!pool) {
    const local = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: local ? undefined : { rejectUnauthorized: true },
      max: 3,
    });
  }

  return drizzle(pool, { schema });
}
