/**
 * Věkové meze pro zahájení výcviku.
 *
 * Zákon dovoluje zahájit výcvik nejdříve 18 měsíců před dosažením věku
 * předepsaného pro udělení řidičského oprávnění. Proto může patnáctiletý
 * začít na skupinu B — ale ne jedenáctiletý.
 *
 * POZOR: čísla níž jsou ta nejnižší zákonná cesta k dané skupině.
 * U skupiny A je to 20 let (po dvou letech s A2); kdo jde na A rovnou,
 * potřebuje 24. Systém tady schválně nebrání tomu, co je aspoň někudy
 * možné — hlídá nesmysly, ne každou odbočku.
 */

import { posunMesice } from "@/lib/datum";

export const VEK_PRO_SKUPINU: Record<string, number> = {
  AM: 15,
  A1: 16,
  A2: 18,
  A: 20,
  // B17 s mentorem je od 17 let; mentory neevidujeme, takže bereme 17
  B: 17,
  "B+E": 18,
  B96: 18,
};

/** O kolik měsíců dřív než v předepsaném věku smí výcvik začít. */
export const PREDSTIH_MESICU = 18;


/** Nejbližší den, kdy smí výcvik na danou skupinu začít. */
export function nejdrivZahajeni(
  datumNarozeni: string,
  skupina: string,
): string | null {
  const vek = VEK_PRO_SKUPINU[skupina];
  if (!vek) return null;
  return posunMesice(datumNarozeni, vek * 12 - PREDSTIH_MESICU);
}

/** Den, kdy žadatel dosáhne věku pro udělení oprávnění. */
export function denDosazeniVeku(
  datumNarozeni: string,
  skupina: string,
): string | null {
  const vek = VEK_PRO_SKUPINU[skupina];
  if (!vek) return null;
  return posunMesice(datumNarozeni, vek * 12);
}

export type Posudek = {
  ok: boolean;
  nejdriv: string | null;
  dosazeniVeku: string | null;
  vek: number | null;
  duvod?: string;
};

/** Smí tenhle žadatel k tomuhle dni zahájit výcvik na danou skupinu? */
export function posudVek(
  datumNarozeni: string,
  skupina: string,
  kDatu: string,
): Posudek {
  const vek = VEK_PRO_SKUPINU[skupina] ?? null;
  const nejdriv = nejdrivZahajeni(datumNarozeni, skupina);
  const dosazeniVeku = denDosazeniVeku(datumNarozeni, skupina);

  if (!nejdriv || !vek) {
    return { ok: true, nejdriv, dosazeniVeku, vek };
  }

  if (kDatu < nejdriv) {
    const d = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("cs-CZ");
    return {
      ok: false,
      nejdriv,
      dosazeniVeku,
      vek,
      duvod:
        `Na skupinu ${skupina} je předepsaných ${vek} let a výcvik smí začít nejdřív ` +
        `${PREDSTIH_MESICU} měsíců předtím — tedy ${d(nejdriv)}. ` +
        `Oprávnění může získat ${d(dosazeniVeku!)}.`,
    };
  }

  return { ok: true, nejdriv, dosazeniVeku, vek };
}
