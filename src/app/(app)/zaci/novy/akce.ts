"use server";

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vycviky, zaci } from "@/db/schema";
import { normalizujRodneCislo, overRodneCislo } from "@/lib/rodne-cislo";
import { posudVek } from "@/lib/vek";
import { dnesek } from "@/lib/datum";
import { overTelefon } from "@/lib/telefon";
import { sifrovaniFunguje, zasifruj } from "@/lib/sifrovani";

export type StavFormulare = {
  chyba?: string;
  pole?: string;
  /** Co uživatel napsal — aby při chybě nemusel nic psát znovu. */
  hodnoty?: Record<string, string>;
};

/** Vytáhne z formuláře všechno, co se dá vrátit zpátky do políček. */
function vsechnyHodnoty(f: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function text(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  if (typeof v !== "string") return null;
  const o = v.trim();
  return o === "" ? null : o;
}

export async function prijmiZaka(
  _predchozi: StavFormulare,
  f: FormData,
): Promise<StavFormulare> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  /** Chyba, která si s sebou nese všechno, co už bylo napsané. */
  const chyba = (zprava: string, pole?: string): StavFormulare => ({
    chyba: zprava,
    pole,
    hodnoty,
  });

  const jmeno = text(f, "jmeno");
  const prijmeni = text(f, "prijmeni");
  const datumNarozeni = text(f, "datumNarozeni");
  const skupina = text(f, "skupina");
  const rodneCislo = text(f, "rodneCislo");

  if (!jmeno) return chyba("Jméno musí být vyplněné.", "jmeno");
  if (!prijmeni) return chyba("Příjmení musí být vyplněné.", "prijmeni");
  if (!datumNarozeni) return chyba("Datum narození musí být vyplněné.", "datumNarozeni");
  if (!skupina) return chyba("Vyber skupinu.", "skupina");

  const podani = text(f, "datumPodaniZadosti") ?? dnesek();

  // Výcvik smí začít nejdřív 18 měsíců před dosažením předepsaného věku.
  // Bez téhle kontroly by systém přijal jedenáctileté dítě na skupinu B.
  const posudek = posudVek(datumNarozeni, skupina, podani);
  if (!posudek.ok) return chyba(posudek.duvod!, "datumNarozeni");

  // Rodné číslo je pro podání na zkoušky povinné, takže ho chceme hned.
  if (!rodneCislo) return chyba("Rodné číslo musí být vyplněné.", "rodneCislo");

  // Úřad podle bydliště je potřeba k podání, tak ať se na něj nezapomene.
  const orpBydliste = text(f, "orpBydliste");
  if (!orpBydliste) {
    return chyba("Vyplň úřad (ORP) podle bydliště žadatele.", "orpBydliste");
  }

  const telefon = text(f, "telefon");
  if (telefon) {
    const t = overTelefon(telefon);
    if (!t.ok) return chyba(t.duvod!, "telefon");
  }

  // U rozšíření potřebujeme vědět, co už žadatel má — jde to do podání.
  const druh = text(f, "druh") ?? "prvni";
  const skupinyZPrukazu = f.getAll("stavajiciSkupiny").filter((v): v is string => typeof v === "string");
  const ridicskyPrukazCislo = text(f, "ridicskyPrukazCislo");

  if (druh === "rozsireni" || druh === "bodovy") {
    const co = druh === "rozsireni" ? "rozšíření" : "přezkoušení";
    if (!ridicskyPrukazCislo) {
      return chyba(`U ${co} vyplň číslo stávajícího řidičského průkazu.`, "ridicskyPrukazCislo");
    }
    if (skupinyZPrukazu.length === 0) {
      return chyba(`U ${co} označ skupiny, které už žadatel má.`, "stavajiciSkupiny");
    }
  }

  const rc = normalizujRodneCislo(rodneCislo);
  const kontrola = overRodneCislo(rc);
  if (!kontrola.ok) return chyba(kontrola.duvod!, "rodneCislo");

  if (!sifrovaniFunguje()) {
    return chyba(
      "Není nastavený šifrovací klíč, takže rodné číslo nelze bezpečně uložit. Zkontroluj stav systému.",
    );
  }

  const idVycviku = await proAutoskolu(kdo.autoskola.id, async (tx) => {
    // Evidenční číslo: jeden zápis, který se zamkne, takže dva současné
    // příjmy nedostanou stejné číslo a řada zůstane nepřetržitá.
    const { rows } = (await tx.execute(sql`
      insert into cisleni_rady (tenant_id, posledni_evidencni_cislo)
      values (${kdo.autoskola.id}, 1)
      on conflict (tenant_id) do update
        set posledni_evidencni_cislo = cisleni_rady.posledni_evidencni_cislo + 1
      returning posledni_evidencni_cislo
    `)) as unknown as { rows: { posledni_evidencni_cislo: number }[] };

    const evidencniCislo = Number(rows[0].posledni_evidencni_cislo);

    const [zak] = await tx
      .insert(zaci)
      .values({
        tenantId: kdo.autoskola.id,
        jmeno,
        prijmeni,
        titul: text(f, "titul"),
        rodnePrijmeni: text(f, "rodnePrijmeni"),
        datumNarozeni,
        mistoNarozeni: text(f, "mistoNarozeni"),
        statniPrislusnost: text(f, "statniPrislusnost") ?? "ČR",
        rodneCisloSifr: zasifruj(rc),
        rodneCisloKonec: rc.slice(-4),
        ulice: text(f, "ulice"),
        mesto: text(f, "mesto"),
        psc: text(f, "psc"),
        telefon: text(f, "telefon"),
        email: text(f, "email"),
        dokladTyp: text(f, "dokladTyp"),
        dokladCislo: text(f, "dokladCislo"),
      })
      .returning({ id: zaci.id });

    const [vycvik] = await tx
      .insert(vycviky)
      .values({
        tenantId: kdo.autoskola.id,
        zakId: zak.id,
        evidencniCislo,
        skupina,
        druh,
        lekarskyPosudek: text(f, "lekarskyPosudek"),
        datumPodaniZadosti: podani,
        orpBydliste,
        ridicskyPrukazCislo,
        stavajiciSkupiny: skupinyZPrukazu.length ? skupinyZPrukazu.join(", ") : null,
        ucitelId: text(f, "ucitelId"),
        stav: "zadost",
      })
      .returning({ id: vycviky.id });

    return vycvik.id;
  });

  redirect(`/zaci/${idVycviku}`);
}
