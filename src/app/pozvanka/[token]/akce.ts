"use server";

import { vyzvedniPozvanku } from "@/lib/pozvanky";
import { NEJMENE_ZNAKU } from "@/lib/hesla";

/**
 * Nastavení hesla z pozvánky.
 *
 * Heslo se nikam nevrací a nikam nezapisuje kromě otisku v databázi.
 * Chybové hlášky schválně neprozrazují, proč odkaz neplatí — jestli
 * vypršel, byl použitý nebo nikdy neexistoval, do toho nikomu nic není.
 */
export type StavPozvanky = { chyba?: string; hotovo?: boolean };

export async function nastavHeslo(
  _p: StavPozvanky,
  f: FormData,
): Promise<StavPozvanky> {
  const token = f.get("token");
  const heslo = f.get("heslo");
  const znovu = f.get("znovu");

  if (typeof token !== "string" || token === "") {
    return { chyba: "Odkaz neplatí." };
  }
  if (typeof heslo !== "string" || heslo.length < NEJMENE_ZNAKU) {
    return { chyba: `Heslo musí mít aspoň ${NEJMENE_ZNAKU} znaků.` };
  }
  if (heslo !== znovu) {
    return { chyba: "Hesla se neshodují." };
  }

  const vysledek = await vyzvedniPozvanku(token, heslo);
  if (vysledek.chyba) return { chyba: vysledek.chyba };

  return { hotovo: true };
}
