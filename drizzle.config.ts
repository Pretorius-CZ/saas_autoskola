import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit běží mimo Next.js, takže si proměnné musí načíst sám
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrace zakládají a mění tabulky — na to je potřeba účet vlastníka.
    // Aplikace samotná se připojuje omezeným účtem (DATABASE_URL).
    url: process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL!,
  },
} satisfies Config;
