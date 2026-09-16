import {
  boolean,
  date,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * AUTOŠKOLA
 *
 * Jeden záznam = jedna autoškola. I když ji teď budeš mít jednu,
 * všechno ostatní na ni od začátku visí. Přidat to později by znamenalo
 * přepsat každý dotaz v aplikaci.
 * ------------------------------------------------------------------ */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  nazev: text("nazev").notNull(),
  ico: text("ico"),
  // číslo registrace k provozování autoškoly (§ 2 zákona 247/2000 Sb.)
  cisloRegistrace: text("cislo_registrace"),
  // ORP, u které je autoškola registrovaná a kam podává hlášení
  orpPodani: text("orp_podani"),

  ulice: text("ulice"),
  mesto: text("mesto"),
  psc: text("psc"),
  email: text("email"),
  telefon: text("telefon"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * PŘIHLAŠOVÁNÍ
 *
 * Tvar těchto čtyř tabulek si neurčujeme my — očekává ho knihovna
 * Better Auth. Nepřejmenovávej v nich sloupce.
 *
 * Vlastní jsou jen dva sloupce v users: tenantId a role.
 * ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // naše pole
  tenantId: uuid("tenant_id").references(() => tenants.id),
  // 'spravce' = ty, 'ucitel' = učitel, 'zak' = žák (přibude později)
  role: text("role").notNull().default("ucitel"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  // heslo je tady, a to jako otisk (hash) — původní heslo nikde neexistuje
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * UČITELÉ
 *
 * Učitel nemusí mít účet v systému (userId zůstane prázdné) —
 * karta učitele existuje kvůli evidenci, ne kvůli přihlašování.
 * ------------------------------------------------------------------ */

export const ucitele = pgTable("ucitele", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),

  jmeno: text("jmeno").notNull(),
  prijmeni: text("prijmeni").notNull(),
  email: text("email"),
  telefon: text("telefon"),

  // profesní osvědčení učitele (§ 21 zákona 247/2000 Sb.)
  cisloOsvedceni: text("cislo_osvedceni"),
  osvedceniPlatnostDo: date("osvedceni_platnost_do"),
  // lékařská prohlídka učitele
  zdravotniZpusobilostDo: date("zdravotni_zpusobilost_do"),
  // skupiny, které smí učit — zatím jako prostý text, např. "B, B+E"
  skupiny: text("skupiny"),

  bankovniUcet: text("bankovni_ucet"),
  poznamka: text("poznamka"),
  aktivni: boolean("aktivni").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * VOZIDLA
 *
 * Úřad pro registraci autoškoly potřebuje značku, typ a RZ.
 * STK je navíc — úřadu do ní nic není, hlídáš si ji ty.
 * ------------------------------------------------------------------ */

export const vozidla = pgTable("vozidla", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  znacka: text("znacka").notNull(),
  typ: text("typ").notNull(),
  rz: text("rz").notNull(),
  skupina: text("skupina").notNull().default("B"),

  // pro tebe, ne pro úřad
  stkDo: date("stk_do"),
  poznamka: text("poznamka"),
  aktivni: boolean("aktivni").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type Uzivatel = typeof users.$inferSelect;
export type Ucitel = typeof ucitele.$inferSelect;
export type Vozidlo = typeof vozidla.$inferSelect;
