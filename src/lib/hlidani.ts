import { dniDo, formatDatum, posunDny, posunMesice } from "@/lib/datum";

/**
 * Co u výcviku hoří.
 *
 * Rozdíl proti úplnému výpisu lhůt: tohle mlčí, dokud není co říct.
 * Karta žáka nemá být přednáška o zákoně — má upozornit, když se blíží
 * termín, a jinak nezabírat místo.
 */

export type Naléhavost = "propadlo" | "blizi_se" | "info";

export type Upozorneni = {
  klic: string;
  text: string;
  paragraf: string;
  naléhavost: Naléhavost;
};

type Vycvik = {
  lekarskyPosudek: string | null;
  datumPodaniZadosti: string | null;
  datumZahajeni: string | null;
  datumUkonceni: string | null;
  datumPrihlasky: string | null;
  datumPrvniZkousky: string | null;
  datumDokonceni: string | null;
  stav: string;
};

/** "zbývá 12 dní" / "zbývá 1 den" / "je po termínu o 3 dny" */
function kolikZbyva(dni: number): string {
  if (dni < 0) {
    const p = -dni;
    return `po termínu o ${p} ${p === 1 ? "den" : p < 5 ? "dny" : "dní"}`;
  }
  if (dni === 0) return "dnes je poslední den";
  return `zbývá ${dni} ${dni === 1 ? "den" : dni < 5 ? "dny" : "dní"}`;
}

export function hlidani(v: Vycvik): Upozorneni[] {
  const out: Upozorneni[] = [];

  if (v.stav === "zruseno") return out;

  // --- 15 dnů na přihlášku. Krátká lhůta, hlásíme ji vždycky. ----------
  if (v.datumUkonceni && !v.datumPrihlasky) {
    const meze = posunDny(v.datumUkonceni, 15);
    const dni = dniDo(meze)!;
    out.push({
      klic: "patnact",
      text: `Přihlásit ke zkoušce do ${formatDatum(meze)} — ${kolikZbyva(dni)}`,
      paragraf: "§ 32",
      naléhavost: dni < 0 ? "propadlo" : "blizi_se",
    });
  }

  // --- 12 měsíců na dokončení zkoušek. Hlásíme, až se to blíží. -------
  if (v.datumPrvniZkousky && !v.datumDokonceni) {
    const meze = posunMesice(v.datumPrvniZkousky, 12);
    const dni = dniDo(meze)!;
    if (dni <= 90) {
      out.push({
        klic: "dvanact",
        text: `Na dokončení zkoušek ${kolikZbyva(dni)} (do ${formatDatum(meze)})`,
        paragraf: "§ 39",
        naléhavost: dni < 0 ? "propadlo" : "blizi_se",
      });
    }
  }

  // --- 18 měsíců na výcvik. Taky až když se to blíží. ------------------
  if (v.datumZahajeni && !v.datumUkonceni) {
    const meze = posunMesice(v.datumZahajeni, 18);
    const dni = dniDo(meze)!;
    if (dni <= 60) {
      out.push({
        klic: "osmnact",
        text: `Výcvik musí skončit do ${formatDatum(meze)} — ${kolikZbyva(dni)}`,
        paragraf: "§ 13",
        naléhavost: dni < 0 ? "propadlo" : "blizi_se",
      });
    }
  }

  // --- lékařský posudek: buď chybí, nebo byl při podání starý ----------
  if (!v.lekarskyPosudek) {
    out.push({
      klic: "posudek-chybi",
      text: "Není vyplněný lékařský posudek",
      paragraf: "§ 13",
      naléhavost: "info",
    });
  } else if (v.datumPodaniZadosti) {
    const platilDo = posunMesice(v.lekarskyPosudek, 3);
    if (v.datumPodaniZadosti > platilDo) {
      out.push({
        klic: "posudek-stary",
        text: `Posudek byl při podání žádosti starší tří měsíců (platil do ${formatDatum(platilDo)})`,
        paragraf: "§ 13",
        naléhavost: "propadlo",
      });
    }
  }

  // nejnaléhavější nahoru
  const poradi: Record<Naléhavost, number> = { propadlo: 0, blizi_se: 1, info: 2 };
  return out.sort((a, b) => poradi[a.naléhavost] - poradi[b.naléhavost]);
}
