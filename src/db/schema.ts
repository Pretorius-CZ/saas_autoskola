import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Nájemce = jedna autoškola.
 *
 * Tabulka existuje už teď, i když je nájemce zatím jediný. Od druhého týdne
 * na ni bude navázaná politika RLS a sloupec tenant_id ponese každá další
 * tabulka — proto vzniká jako první.
 */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  nazev: text("nazev").notNull(),
  ico: text("ico"),
  /** Číslo registrace k provozování autoškoly přidělené ORP. */
  cisloRegistrace: text("cislo_registrace"),
  /** Úřad, kterému se posílají podání — plyne z registrace, ne z adresy žáka. */
  orpPodani: text("orp_podani"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
