import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { formatDatum } from "@/lib/datum";
import { formatTelefon } from "@/lib/telefon";

/**
 * Vyplnění úředního tiskopisu žádosti o přijetí k výuce a výcviku.
 *
 * Tiskopis je z roku 2013 a je závazný — musí vypadat přesně takhle.
 * Nekreslíme tedy vlastní formulář, ale vepisujeme hodnoty do originálu
 * na změřená místa. Kdyby ministerstvo tiskopis změnilo, vymění se
 * soubor a přeměří souřadnice; kód zůstane.
 *
 * Co se ZÁMĚRNĚ nevyplňuje:
 *   - čestné prohlášení (místo a datum) — vypisuje se rukou při podpisu
 *   - souhlas zákonného zástupce
 *   - CELÁ spodní část "vyplňuje provozovatel autoškoly" — data i evidenční
 *     číslo si autoškola dopisuje ručně, každá má vlastní číselnou řadu
 *   - razítka a podpisy
 *   - část pro vstupní školení u skupin C a D
 * Podpis žadatele a pod ním podpis zákonného zástupce se dělají najednou
 * na papíře. Nic z toho systém předtiskovat nemá.
 *
 * Souřadnice odpovídají A4 (595,25 × 841,9 bodu):
 *   x      = kde začíná tečkovaná linka
 *   yShora = účaří textu měřené od horního okraje stránky
 *   sirka  = kolik je místa, než se narazí do dalšího pole
 */

const VYSKA_STRANKY = 841.9;
const VELIKOST_PISMA = 9;

/**
 * O kolik bodů psát nad tečkovanou linku.
 *
 * Účaří tečkované linky je zároveň účařím textu, takže bez posunu by
 * hodnota seděla přímo na tečkách a špatně se četla. Řádky jsou od sebe
 * asi 20 bodů, takže do řádku nad se to nedostane.
 */
const NAD_LINKOU = 4;

const POLE = {
  skupina:          { x: 369, yShora: 83.6,  sirka: 139 },
  drzitelSkupiny:   { x: 272, yShora: 104.2, sirka: 103 },
  cisloRidicskeho:  { x: 454, yShora: 104.2, sirka: 51 },
  jmeno:            { x: 89,  yShora: 145.8, sirka: 118 },
  prijmeni:         { x: 282, yShora: 145.8, sirka: 222 },
  datumNarozeni:    { x: 121, yShora: 166.4, sirka: 87 },
  mistoNarozeni:    { x: 249, yShora: 166.4, sirka: 78 },
  rodneCislo:       { x: 381, yShora: 166.4, sirka: 123 },
  obcanstvi:        { x: 122, yShora: 187.0, sirka: 84 },
  dokladCislo:      { x: 309, yShora: 187.0, sirka: 83 },
  telefon:          { x: 415, yShora: 187.0, sirka: 89 },
  adresa:           { x: 120, yShora: 207.9, sirka: 296 },
  psc:              { x: 421, yShora: 207.9, sirka: 83 },
  orpBydliste:      { x: 328, yShora: 228.6, sirka: 177 },
} as const;

type Klic = keyof typeof POLE;

export type UdajeZadosti = {
  skupina: string;
  drzitelSkupin: string | null;
  cisloRidicskeho: string | null;
  jmeno: string;
  prijmeni: string;
  titul: string | null;
  datumNarozeni: string;
  mistoNarozeni: string | null;
  rodneCislo: string | null;
  statniPrislusnost: string | null;
  dokladCislo: string | null;
  telefon: string | null;
  ulice: string | null;
  mesto: string | null;
  psc: string | null;
  orpBydliste: string | null;
};

function slozAdresu(u: UdajeZadosti): string | null {
  const casti = [u.ulice, u.mesto].filter(Boolean);
  return casti.length ? casti.join(", ") : null;
}

export async function vyplnZadost(u: UdajeZadosti): Promise<Uint8Array> {
  const slozka = path.join(process.cwd(), "src", "tiskopisy");
  const [sablona, pismo] = await Promise.all([
    readFile(path.join(slozka, "zadost-2013.pdf")),
    readFile(path.join(slozka, "LiberationSans-Regular.ttf")),
  ]);

  const doc = await PDFDocument.load(sablona);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(pismo, { subset: true });
  const [strana] = doc.getPages();

  const inkoust = rgb(0, 0, 0);

  function napis(klic: Klic, text: string | null | undefined) {
    if (!text) return;
    const p = POLE[klic];

    // Když se text nevejde, zmenšíme ho. Radši drobněji než přes okraj.
    let velikost = VELIKOST_PISMA;
    while (velikost > 5 && font.widthOfTextAtSize(text, velikost) > p.sirka) {
      velikost -= 0.5;
    }

    strana.drawText(text, {
      x: p.x,
      y: VYSKA_STRANKY - p.yShora + NAD_LINKOU,
      size: velikost,
      font,
      color: inkoust,
    });
  }

  napis("skupina", u.skupina);
  napis("drzitelSkupiny", u.drzitelSkupin);
  napis("cisloRidicskeho", u.cisloRidicskeho);

  napis("jmeno", u.jmeno);
  napis("prijmeni", u.titul ? `${u.prijmeni} (${u.titul})` : u.prijmeni);
  napis("datumNarozeni", formatDatum(u.datumNarozeni));
  napis("mistoNarozeni", u.mistoNarozeni);
  napis("rodneCislo", u.rodneCislo);
  napis("obcanstvi", u.statniPrislusnost);
  napis("dokladCislo", u.dokladCislo);
  napis("telefon", u.telefon ? formatTelefon(u.telefon) : null);
  napis("adresa", slozAdresu(u));
  napis("psc", u.psc);
  napis("orpBydliste", u.orpBydliste);

  // Čestné prohlášení (místo a datum) schválně NEVYPLŇUJEME.
  // Žadatel ho vypisuje rukou ve chvíli, kdy se pod něj podepisuje —
  // předtištěné datum by z prohlášení dělalo formalitu.

  return doc.save();
}
