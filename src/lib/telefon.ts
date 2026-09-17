/**
 * Telefonní čísla.
 *
 * Ukládáme je tak, jak je člověk napsal — jen ověříme, že jich je devět.
 * Předvolbu +420 nevyžadujeme ani nedoplňujeme: v autoškole si nikdo
 * nepíše telefon s předvolbou a nutit ho do toho by bylo otravné.
 */

/** Jen číslice, bez mezer, závorek a předvolby. */
export function cislice(vstup: string): string {
  return vstup.replace(/^\+?420/, "").replace(/\D/g, "");
}

export function overTelefon(vstup: string): { ok: boolean; duvod?: string } {
  const c = cislice(vstup);

  if (c.length === 0) return { ok: true };

  if (c.length !== 9) {
    return {
      ok: false,
      duvod: `Telefon má mít devět číslic, tenhle jich má ${c.length}.`,
    };
  }

  return { ok: true };
}

/** "601 111 111" — jen pro zobrazení, do databáze jde, co člověk napsal. */
export function formatTelefon(vstup: string | null): string {
  if (!vstup) return "—";
  const c = cislice(vstup);
  if (c.length !== 9) return vstup;
  return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}`;
}
