import { asc, eq, ne } from "drizzle-orm";
import { jeToken, proRozvrh } from "@/lib/db-tenant";
import { terminy, ucitele, vycviky, zaci } from "@/db/schema";
import { PREDMETY } from "@/lib/osnova";

/**
 * Načtení osobního rozvrhu žáka podle odkazu z e-mailu.
 *
 * Stránka i stažení do kalendáře čtou tutéž věc, proto je to tady a ne
 * dvakrát. Dotaz má podmínku na token, i když ji databáze sama vynucuje
 * pravidlem — dvě obrany jsou lepší než jedna a v dotazu je aspoň vidět,
 * co se čeká.
 */
export type Termin = {
  id: string;
  zacatek: Date;
  delkaMinut: number;
  druh: string;
  predmet: string | null;
  tema: string | null;
  misto: string | null;
  stav: string;
  ucitel: string | null;
};

export type Rozvrh = {
  jmeno: string;
  prijmeni: string;
  skupina: string;
  terminy: Termin[];
};

export async function nactiRozvrh(token: string): Promise<Rozvrh | null> {
  if (!jeToken(token)) return null;

  return proRozvrh(token, async (tx) => {
    const [zaznam] = await tx
      .select({
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
        skupina: vycviky.skupina,
      })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(eq(vycviky.tokenRozvrhu, token))
      .limit(1);

    if (!zaznam) return null;

    // Které termíny to jsou, rozhoduje pravidlo v databázi: jeho jízdy
    // a teorie jeho kurzu. Zrušené se neukazují — v kalendáři, který si
    // žák přidá odkazem, tím zmizí i z jeho telefonu.
    const seznam = await tx
      .select({
        id: terminy.id,
        zacatek: terminy.zacatek,
        delkaMinut: terminy.delkaMinut,
        druh: terminy.druh,
        predmet: terminy.predmet,
        tema: terminy.tema,
        misto: terminy.misto,
        stav: terminy.stav,
        ucitel: ucitele.prijmeni,
      })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .where(ne(terminy.stav, "zruseno"))
      .orderBy(asc(terminy.zacatek));

    return { ...zaznam, terminy: seznam };
  });
}

/** Jak se termín jmenuje pro žáka — na stránce i v kalendáři stejně. */
export function nazevTerminu(t: Termin, skupina: string): string {
  if (t.druh === "jizda") return "Jízda";
  if (t.druh === "udrzba") return "Údržba vozidla";
  if (t.druh === "zdravotni") return "Zdravotnická příprava";

  const predmet = (PREDMETY[skupina] ?? []).find((p) => p.klic === t.predmet);
  return predmet ? `Konzultace: ${predmet.nazev}` : "Konzultace";
}
