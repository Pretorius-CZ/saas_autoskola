import { z } from "zod";

/**
 * Jediné místo, kde se čtou proměnné prostředí.
 * Nikde jinde v aplikaci nesmí být process.env — jinak se za půl roku
 * nedá zjistit, co všechno aplikace ke svému běhu potřebuje.
 */
const schema = z.object({
  // V prvním týdnu ještě nemusí být vyplněno — stavová stránka to pozná a řekne.
  DATABASE_URL: z.string().min(1).optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Chybná konfigurace prostředí:", parsed.error.flatten().fieldErrors);
  throw new Error("Neplatné proměnné prostředí. Zkontroluj .env.local podle .env.example.");
}

export const env = parsed.data;
