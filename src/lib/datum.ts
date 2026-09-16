/**
 * Práce s daty, která jsou v databázi uložená jako "2027-03-14".
 * Schválně bez knihovny — je toho málo a závislost navíc by se jednou
 * musela aktualizovat.
 */

export function dniDo(datum: string | null | undefined): number | null {
  if (!datum) return null;

  const cil = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(cil.getTime())) return null;

  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);

  return Math.round((cil.getTime() - dnes.getTime()) / 86_400_000);
}

export function formatDatum(datum: string | null | undefined): string {
  if (!datum) return "—";
  const d = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ");
}
