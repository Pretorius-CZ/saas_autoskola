import { z } from "zod";

/**
 * Jediné místo, kde se čtou proměnné prostředí.
 * Nikde jinde v aplikaci nesmí být process.env — jinak se za půl roku
 * nedá zjistit, co všechno aplikace ke svému běhu potřebuje.
 */
const schema = z.object({
  // Nepovinné schválně: stavová stránka umí říct, že chybí,
  // místo aby se celá aplikace odmítla spustit.
  DATABASE_URL: z.string().min(1).optional(),

  // Podepisuje přihlášení. Bez něj přihlašování nefunguje.
  BETTER_AUTH_SECRET: z.string().min(32).optional(),

  // Adresa, na které aplikace běží. Lokálně se dopočítá,
  // na Vercelu ji dodá VERCEL_URL.
  BETTER_AUTH_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),

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

/** Adresa, na které aplikace běží. */
export function adresaAplikace(): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}
