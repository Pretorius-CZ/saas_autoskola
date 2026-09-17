/**
 * Názvy dat průběhu.
 *
 * Schválně mimo soubor s akcemi: ten je označený "use server" a takový
 * soubor smí vyvážet jen funkce. Seznam v něm být nemůže, i když k němu
 * logicky patří.
 */
export const MILNIKY = [
  "datumZahajeni",
  "datumUkonceni",
  "datumPrihlasky",
  "datumPrvniZkousky",
  "datumDokonceni",
] as const;

export type Milnik = (typeof MILNIKY)[number];
