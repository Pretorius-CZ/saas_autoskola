import { dniDo, formatDatum, posunDny, posunMesice } from "@/lib/datum";

/**
 * Čtyři zákonné lhůty, které u každého výcviku běží.
 *
 * Nejsou to připomínky, které si někdo vymyslel — jejich zmeškání
 * znamená, že se výcvik musí opakovat, nebo že žák ke zkoušce nesmí.
 * Proto je systém počítá sám a nečeká, až si na ně někdo vzpomene.
 */

export type StavLhuty = "splneno" | "bezi" | "blizi_se" | "propadlo" | "neaktivni";

export type Lhuta = {
  klic: string;
  nazev: string;
  paragraf: string;
  popis: string;
  stav: StavLhuty;
  detail: string;
};

type Vstup = {
  lekarskyPosudek: string | null;
  datumPodaniZadosti: string | null;
  datumZahajeni: string | null;
  datumUkonceni: string | null;
  datumPrihlasky: string | null;
  datumPrvniZkousky: string | null;
  datumDokonceni: string | null;
};


/** Z termínu udělá stav podle toho, kolik zbývá dní. */
function podleTerminu(termin: string, predstih: number): { stav: StavLhuty; detail: string } {
  const dni = dniDo(termin);
  if (dni === null) return { stav: "neaktivni", detail: "—" };
  if (dni < 0) return { stav: "propadlo", detail: `propadlo ${formatDatum(termin)}` };
  if (dni <= predstih)
    return { stav: "blizi_se", detail: `do ${formatDatum(termin)} · zbývá ${dni} dní` };
  return { stav: "bezi", detail: `do ${formatDatum(termin)}` };
}

export function spocitejLhuty(v: Vstup): Lhuta[] {
  const lhuty: Lhuta[] = [];

  // --- 1. lékařský posudek nejvýš 3 měsíce před podáním žádosti -------
  {
    const zaklad: Omit<Lhuta, "stav" | "detail"> = {
      klic: "posudek",
      nazev: "Lékařský posudek",
      paragraf: "§ 13",
      popis: "Při podání žádosti nesmí být starší tří měsíců.",
    };

    if (!v.lekarskyPosudek) {
      lhuty.push({ ...zaklad, stav: "neaktivni", detail: "nevyplněno" });
    } else {
      const platiDo = posunMesice(v.lekarskyPosudek, 3);
      if (v.datumPodaniZadosti) {
        // Žádost je podaná — je to už jen konstatování, ne odpočet.
        const ok = v.datumPodaniZadosti <= platiDo;
        lhuty.push({
          ...zaklad,
          stav: ok ? "splneno" : "propadlo",
          detail: ok
            ? `posudek ${formatDatum(v.lekarskyPosudek)}, žádost ${formatDatum(v.datumPodaniZadosti)}`
            : `posudek byl při podání žádosti starší tří měsíců`,
        });
      } else {
        lhuty.push({ ...zaklad, ...podleTerminu(platiDo, 14) });
      }
    }
  }

  // --- 2. od zahájení do ukončení výcviku nejvýš 18 měsíců ------------
  {
    const zaklad: Omit<Lhuta, "stav" | "detail"> = {
      klic: "osmnact",
      nazev: "Délka výcviku",
      paragraf: "§ 13",
      popis: "Od zahájení do ukončení výcviku nejvýš 18 měsíců.",
    };

    if (!v.datumZahajeni) {
      lhuty.push({ ...zaklad, stav: "neaktivni", detail: "výcvik nezačal" });
    } else {
      const meze = posunMesice(v.datumZahajeni, 18);
      if (v.datumUkonceni) {
        const ok = v.datumUkonceni <= meze;
        lhuty.push({
          ...zaklad,
          stav: ok ? "splneno" : "propadlo",
          detail: ok
            ? `ukončeno ${formatDatum(v.datumUkonceni)}`
            : `výcvik přesáhl 18 měsíců (mez ${formatDatum(meze)})`,
        });
      } else {
        lhuty.push({ ...zaklad, ...podleTerminu(meze, 60) });
      }
    }
  }

  // --- 3. do 15 dnů od ukončení výcviku přihlásit ke zkoušce ----------
  {
    const zaklad: Omit<Lhuta, "stav" | "detail"> = {
      klic: "patnact",
      nazev: "Přihlášení ke zkoušce",
      paragraf: "§ 32",
      popis: "Do 15 dnů od ukončení výcviku.",
    };

    if (!v.datumUkonceni) {
      lhuty.push({ ...zaklad, stav: "neaktivni", detail: "výcvik neskončil" });
    } else {
      const meze = posunDny(v.datumUkonceni, 15);
      if (v.datumPrihlasky) {
        const ok = v.datumPrihlasky <= meze;
        lhuty.push({
          ...zaklad,
          stav: ok ? "splneno" : "propadlo",
          detail: ok
            ? `přihlášeno ${formatDatum(v.datumPrihlasky)}`
            : `přihláška podaná po lhůtě (mez ${formatDatum(meze)})`,
        });
      } else {
        lhuty.push({ ...zaklad, ...podleTerminu(meze, 5) });
      }
    }
  }

  // --- 4. od první zkoušky 12 měsíců na dokončení všech ---------------
  {
    const zaklad: Omit<Lhuta, "stav" | "detail"> = {
      klic: "dvanact",
      nazev: "Dokončení zkoušek",
      paragraf: "§ 39",
      popis: "Od první zkoušky 12 měsíců na dokončení všech.",
    };

    if (!v.datumPrvniZkousky) {
      lhuty.push({ ...zaklad, stav: "neaktivni", detail: "zkoušky nezačaly" });
    } else {
      const meze = posunMesice(v.datumPrvniZkousky, 12);
      if (v.datumDokonceni) {
        const ok = v.datumDokonceni <= meze;
        lhuty.push({
          ...zaklad,
          stav: ok ? "splneno" : "propadlo",
          detail: ok
            ? `dokončeno ${formatDatum(v.datumDokonceni)}`
            : `zkoušky nedokončeny do 12 měsíců (mez ${formatDatum(meze)})`,
        });
      } else {
        lhuty.push({ ...zaklad, ...podleTerminu(meze, 45) });
      }
    }
  }

  return lhuty;
}

/** Lhůty, které vyžadují pozornost — pro přehled. */
export function naleha(lhuty: Lhuta[]): Lhuta[] {
  return lhuty.filter((l) => l.stav === "propadlo" || l.stav === "blizi_se");
}
