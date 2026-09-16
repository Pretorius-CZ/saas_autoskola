import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit běží mimo Next.js, takže si proměnné musí načíst sám
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
