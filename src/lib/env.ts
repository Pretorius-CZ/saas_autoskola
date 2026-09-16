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

  // Když je vyplněná, má přednost před vším ostatním.
  BETTER_AUTH_URL: z.string().url().optional(),

  // Tyhle tři dodává Vercel sám.
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  // adresa konkrétního nasazení, mění se s každým buildem
  VERCEL_URL: z.string().optional(),
  // stálá adresa ostré verze — tahle je ta, kterou lidé opravdu otevírají
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),

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

/**
 * Adresa, na které aplikace běží.
 *
 * Na Vercelu existují dvě: stálá adresa ostré verze a adresa jednoho
 * konkrétního nasazení. Přihlašování musí znát tu první — jinak odmítne
 * požadavky z adresy, kterou má člověk v prohlížeči.
 */
export function adresaAplikace(): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;

  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;

  return "http://localhost:3000";
}

/**
 * Adresy, ze kterých přihlašování přijme požadavek.
 * Kromě té hlavní i adresa konkrétního nasazení, aby šlo přihlášení
 * vyzkoušet i na náhledové verzi před nasazením naostro.
 */
export function duveryhodneAdresy(): string[] {
  const seznam = [adresaAplikace()];

  if (env.VERCEL_URL) seznam.push(`https://${env.VERCEL_URL}`);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    seznam.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return [...new Set(seznam)];
}
