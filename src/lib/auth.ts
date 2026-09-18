import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import { adresaAplikace, duveryhodneAdresy, env } from "@/lib/env";
import { NEJMENE_ZNAKU } from "@/lib/hesla";
import * as schema from "@/db/schema";

const db = getDb();

if (!db) {
  throw new Error(
    "Přihlašování potřebuje databázi, ale DATABASE_URL není nastavená. Zkontroluj .env.local.",
  );
}

if (!env.BETTER_AUTH_SECRET) {
  throw new Error(
    "Chybí BETTER_AUTH_SECRET (aspoň 32 znaků). Bez něj nejde podepisovat přihlášení.",
  );
}

export const auth = betterAuth({
  baseURL: adresaAplikace(),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: duveryhodneAdresy(),

  database: drizzleAdapter(db, {
    provider: "pg",
    // Naše tabulky se jmenují v množném čísle, tak knihovně řekneme, kde je má hledat.
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: NEJMENE_ZNAKU,

    // ZAVŘENO. Nikdo si tu nezaloží účet sám — účty zakládá autoškola.
    // Správu účtů pro učitele a žáky postavíme jako vlastní obrazovku;
    // tohle nikdy nepřepínej zpátky na false.
    disableSignUp: true,
  },

  user: {
    additionalFields: {
      tenantId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
    },
  },
});
