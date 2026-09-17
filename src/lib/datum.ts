/**
 * Práce s daty, která jsou v databázi uložená jako "2027-03-14".
 * Schválně bez knihovny — je toho málo a závislost navíc by se jednou
 * musela aktualizovat.
 *
 * POZOR na jednu past, na kterou jsme už jednou naletěli:
 * toISOString() převádí na světový čas. My jsme v létě o dvě hodiny
 * napřed, takže by z 27. 7. vyšlo 26. 7. Datum proto skládáme ručně
 * z místních složek.
 */

/** Datum jako "2027-03-14" z objektu Date, bez převodu na světový čas. */
export function naText(d: Date): string {
  const dvojmistne = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dvojmistne(d.getMonth() + 1)}-${dvojmistne(d.getDate())}`;
}

export function dnesek(): string {
  return naText(new Date());
}

function zTextu(datum: string): Date {
  return new Date(`${datum}T00:00:00`);
}

/** Přičte měsíce. 31. ledna + 1 měsíc = 28. února, ne 3. března. */
export function posunMesice(datum: string, mesicu: number): string {
  const d = zTextu(datum);
  const den = d.getDate();
  d.setMonth(d.getMonth() + mesicu);
  if (d.getDate() !== den) d.setDate(0);
  return naText(d);
}

export function posunDny(datum: string, dnu: number): string {
  const d = zTextu(datum);
  d.setDate(d.getDate() + dnu);
  return naText(d);
}

export function dniDo(datum: string | null | undefined): number | null {
  if (!datum) return null;

  const cil = zTextu(datum);
  if (Number.isNaN(cil.getTime())) return null;

  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);

  return Math.round((cil.getTime() - dnes.getTime()) / 86_400_000);
}

export function formatDatum(datum: string | null | undefined): string {
  if (!datum) return "—";
  const d = zTextu(datum);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ");
}

/** Věk k danému dni. */
export function vekKDatu(narozeni: string, kDatu: string): number {
  const n = zTextu(narozeni);
  const d = zTextu(kDatu);
  let v = d.getFullYear() - n.getFullYear();
  const m = d.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < n.getDate())) v--;
  return v;
}
