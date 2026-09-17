/**
 * Osnova výuky a výcviku.
 *
 * Výuka se u nás vede výhradně individuálním studijním plánem (ISP):
 * žák studuje sám a autoškola mu poskytuje konzultace, nejméně jednu
 * hodinu na každé započaté čtyři hodiny předepsané výuky — a to
 * po jednotlivých předmětech, ne z celkového součtu.
 *
 * Proto je u dvouhodinové údržby jedna konzultace, i když by z celku
 * vyšla nula. Kdyby se počítalo z 36 hodin najednou, vyšlo by 9 místo 11.
 *
 * Skupina pro ISP má nejvýš pět lidí (§ 18 odst. 3).
 */

export const MAX_VE_SKUPINE_ISP = 5;

export type Predmet = {
  klic: string;
  nazev: string;
  /** Hodin výuky podle osnovy. */
  hodin: number;
};

/** Předměty výuky podle skupiny. Zatím ověřeno pro B. */
export const PREDMETY: Record<string, Predmet[]> = {
  B: [
    { klic: "predpisy", nazev: "Předpisy o provozu", hodin: 18 },
    { klic: "udrzba", nazev: "Ovládání a údržba vozidla", hodin: 2 },
    { klic: "teorie", nazev: "Teorie řízení a zásady bezpečné jízdy", hodin: 10 },
    { klic: "zdravotnicka", nazev: "Zdravotnická příprava", hodin: 6 },
  ],
};

/** Nejméně 1 konzultace na každé započaté 4 hodiny výuky. */
export function konzultaciZaPredmet(hodin: number): number {
  return Math.ceil(hodin / 4);
}

/** Kolik konzultací celkem osnova pro skupinu vyžaduje. */
export function konzultaciCelkem(skupina: string): number | null {
  const p = PREDMETY[skupina];
  if (!p) return null;
  return p.reduce((s, x) => s + konzultaciZaPredmet(x.hodin), 0);
}

/**
 * Kolik hodin výcviku (jízd) osnova předepisuje.
 * Zatím jen skupiny, u kterých jsme si čísla ověřili.
 */
export const HODIN_VYCVIKU: Record<string, number> = {
  // 2 h autocvičiště + 12 h II. etapa + 14 h III. etapa
  B: 28,
  // 2 + 10 + 14
  A: 26,
};

/**
 * Předepisuje osnova u tohohle druhu výcviku nějaké hodiny?
 *
 * U přezkoušení (bodový systém) ne — žádné konzultace ani počet jízd
 * se nevyžadují, jen se ohlásí zahájení a jde se ke zkoušce. Ukazovat
 * tam "0 z 28 h" by bylo zavádějící a vypadalo by to jako nesplněné.
 */
export function osnovaPredepisuje(druh: string): boolean {
  return druh !== "bodovy";
}

/** Minuty na vyučovací hodiny, zaokrouhleno na desetinu. */
export function naHodiny(minut: number): number {
  return Math.round((minut / 45) * 10) / 10;
}
