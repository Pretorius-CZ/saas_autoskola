/**
 * Práce s rodným číslem.
 *
 * Schválně v samostatném souboru bez šifrování: tohle potřebuje i formulář
 * v prohlížeči, a ten se k šifrovacímu klíči nesmí dostat ani omylem.
 */

/** Sjednotí zápis na samé číslice, bez lomítka a mezer. */
export function normalizujRodneCislo(vstup: string): string {
  return vstup.replace(/\D/g, "");
}

type Rozbor = {
  rok: number;
  mesic: number;
  den: number;
};

function rozeber(c: string): Rozbor | null {
  if (c.length !== 9 && c.length !== 10) return null;

  const rr = Number(c.slice(0, 2));
  let mesic = Number(c.slice(2, 4));
  const den = Number(c.slice(4, 6));

  // Ženám se k měsíci přičítá 50. Od roku 2004 se navíc smí přičíst 20,
  // když se v daný den vyčerpala řada — pak může vzniknout i 70+.
  if (mesic > 70) mesic -= 70;
  else if (mesic > 50) mesic -= 50;
  else if (mesic > 20) mesic -= 20;

  // Devítimístná se přidělovala do roku 1953, desetimístná od roku 1954.
  const rok = c.length === 9 ? 1900 + rr : rr < 54 ? 2000 + rr : 1900 + rr;

  if (mesic < 1 || mesic > 12 || den < 1 || den > 31) return null;

  // Ověř, že takové datum vůbec existuje (31. února neprojde).
  const d = new Date(Date.UTC(rok, mesic - 1, den));
  if (d.getUTCFullYear() !== rok || d.getUTCMonth() !== mesic - 1 || d.getUTCDate() !== den) {
    return null;
  }

  return { rok, mesic, den };
}

/**
 * DOČASNĚ VYPNUTO kvůli zkoušení na vymyšlených rodných číslech.
 *
 * Až systém uvidí prvního skutečného žáka, přepni na true. Bez téhle
 * kontroly projde překlep v rodném čísle až na podání pro úřad, kde ho
 * odhalí někdo jiný a dráž.
 */
export const KONTROLA_KONTROLNIHO_SOUCTU = false;

/** Ověří tvar, datum a (je-li zapnutá) dělitelnost jedenácti. */
export function overRodneCislo(vstup: string): { ok: boolean; duvod?: string } {
  const c = normalizujRodneCislo(vstup);

  if (c.length !== 9 && c.length !== 10) {
    return { ok: false, duvod: "Rodné číslo má mít 9 nebo 10 číslic." };
  }

  if (!rozeber(c)) {
    return { ok: false, duvod: "Rodné číslo neobsahuje platné datum narození." };
  }

  // Dělitelnost jedenácti se zavedla až u desetimístných.
  if (KONTROLA_KONTROLNIHO_SOUCTU && c.length === 10 && Number(c) % 11 !== 0) {
    return { ok: false, duvod: "Rodné číslo neprošlo kontrolním výpočtem — asi překlep." };
  }

  return { ok: true };
}

/** Datum narození ve tvaru "1994-01-01", nebo null když se nedá určit. */
export function datumNarozeniZRodnehoCisla(vstup: string): string | null {
  const r = rozeber(normalizujRodneCislo(vstup));
  if (!r) return null;

  const dvojmistne = (n: number) => String(n).padStart(2, "0");
  return `${r.rok}-${dvojmistne(r.mesic)}-${dvojmistne(r.den)}`;
}

/** 'zena' | 'muz' — podle přičtení k měsíci. Zatím se nikde nepoužívá. */
export function pohlaviZRodnehoCisla(vstup: string): "muz" | "zena" | null {
  const c = normalizujRodneCislo(vstup);
  if (c.length !== 9 && c.length !== 10) return null;
  const mesic = Number(c.slice(2, 4));
  return mesic > 50 && mesic <= 62 ? "zena" : mesic > 70 ? "zena" : "muz";
}
