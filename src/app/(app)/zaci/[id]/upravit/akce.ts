"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vycviky, zaci } from "@/db/schema";
import { normalizujRodneCislo, overRodneCislo } from "@/lib/rodne-cislo";
import { posudVek } from "@/lib/vek";
import { dnesek } from "@/lib/datum";
import { overTelefon } from "@/lib/telefon";
import { desifruj, sifrovaniFunguje, zasifruj } from "@/lib/sifrovani";
import type { StavFormulare } from "@/lib/typy-formulare";

function vsechnyHodnoty(f: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function text(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  if (typeof v !== "string") return null;
  const o = v.trim();
  return o === "" ? null : o;
}

/**
 * Úprava už založeného žáka a jeho výcviku.
 *
 * Evidenční číslo se nemění nikdy — je to číslo v evidenční knize
 * a přepsat ho by znamenalo přepsat úřední záznam.
 */
export async function upravZaka(
  _predchozi: StavFormulare,
  f: FormData,
): Promise<StavFormulare> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const chyba = (zprava: string, pole?: string): StavFormulare => ({
    chyba: zprava,
    pole,
    hodnoty,
  });

  const id = text(f, "id");
  if (!id) return chyba("Chybí, který výcvik se má upravit.");

  const jmeno = text(f, "jmeno");
  const prijmeni = text(f, "prijmeni");
  const datumNarozeni = text(f, "datumNarozeni");
  const skupina = text(f, "skupina");
  const rodneCislo = text(f, "rodneCislo");

  if (!jmeno) return chyba("Jméno musí být vyplněné.", "jmeno");
  if (!prijmeni) return chyba("Příjmení musí být vyplněné.", "prijmeni");
  if (!datumNarozeni) return chyba("Datum narození musí být vyplněné.", "datumNarozeni");
  if (!skupina) return chyba("Vyber skupinu.", "skupina");
  if (!rodneCislo) return chyba("Rodné číslo musí být vyplněné.", "rodneCislo");

  const rc = normalizujRodneCislo(rodneCislo);
  const kontrola = overRodneCislo(rc);
  if (!kontrola.ok) return chyba(kontrola.duvod!, "rodneCislo");

  if (!sifrovaniFunguje()) {
    return chyba("Není nastavený šifrovací klíč, rodné číslo nelze uložit.");
  }

  const podani = text(f, "datumPodaniZadosti") ?? dnesek();

  const posudek = posudVek(datumNarozeni, skupina, podani);
  if (!posudek.ok) return chyba(posudek.duvod!, "datumNarozeni");

  const orpBydliste = text(f, "orpBydliste");
  if (!orpBydliste) return chyba("Vyplň úřad (ORP) podle bydliště žadatele.", "orpBydliste");

  const telefon = text(f, "telefon");
  if (telefon) {
    const t = overTelefon(telefon);
    if (!t.ok) return chyba(t.duvod!, "telefon");
  }

  // Evidenční číslo smí autoškola přepsat — je to její řada, ne naše.
  const evidencniText = text(f, "evidencniCislo");
  if (!evidencniText) return chyba("Evidenční číslo musí být vyplněné.", "evidencniCislo");

  const evidencniCislo = Number(evidencniText.replace(/\s/g, ""));
  if (!Number.isInteger(evidencniCislo) || evidencniCislo < 1) {
    return chyba("Evidenční číslo musí být celé kladné číslo.", "evidencniCislo");
  }

  const druh = text(f, "druh") ?? "prvni";
  const skupinyZPrukazu = f
    .getAll("stavajiciSkupiny")
    .filter((v): v is string => typeof v === "string");
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

  try {
    await proAutoskolu(kdo, async (tx) => {
    const [vycvik] = await tx
      .select({ zakId: vycviky.zakId })
      .from(vycviky)
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!vycvik) throw new Error("Výcvik nenalezen.");

    // Rodné číslo přešifrujeme jen když se opravdu změnilo. Šifra je
    // pokaždé jiná i pro stejnou hodnotu, takže bychom jinak do historie
    // zapisovali změnu při každém uložení.
    const [puvodni] = await tx
      .select({ sifra: zaci.rodneCisloSifr })
      .from(zaci)
      .where(and(eq(zaci.id, vycvik.zakId), eq(zaci.tenantId, kdo.autoskola.id)))
      .limit(1);

    const rcBezeZmeny = desifruj(puvodni?.sifra ?? null) === rc;

    await tx
      .update(zaci)
      .set({
        jmeno,
        prijmeni,
        titul: text(f, "titul"),
        rodnePrijmeni: text(f, "rodnePrijmeni"),
        datumNarozeni,
        mistoNarozeni: text(f, "mistoNarozeni"),
        statniPrislusnost: text(f, "statniPrislusnost") ?? "ČR",
        ...(rcBezeZmeny ? {} : { rodneCisloSifr: zasifruj(rc), rodneCisloKonec: rc.slice(-4) }),
        ulice: text(f, "ulice"),
        mesto: text(f, "mesto"),
        psc: text(f, "psc"),
        telefon,
        email: text(f, "email"),
        dokladTyp: text(f, "dokladTyp"),
        dokladCislo: text(f, "dokladCislo"),
        updatedAt: new Date(),
      })
      .where(and(eq(zaci.id, vycvik.zakId), eq(zaci.tenantId, kdo.autoskola.id)));

    await tx
      .update(vycviky)
      .set({
        evidencniCislo,
        skupina,
        druh,
        lekarskyPosudek: text(f, "lekarskyPosudek"),
        datumPodaniZadosti: podani,
        orpBydliste,
        ucitelId: text(f, "ucitelId"),
        ridicskyPrukazCislo,
        stavajiciSkupiny: skupinyZPrukazu.length ? skupinyZPrukazu.join(", ") : null,
        updatedAt: new Date(),
      })
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)));
    });
  } catch (e) {
    // Jediná chyba, kterou tu čekáme, je obsazené evidenční číslo.
    // Hlídá to databáze, takže ho nemohou dostat dva výcviky.
    const zprava = e instanceof Error ? e.message : String(e);
    if (zprava.includes("vycviky_evidencni_cislo_unikat")) {
      return chyba(`Evidenční číslo ${evidencniCislo} už má jiný výcvik.`, "evidencniCislo");
    }
    throw e;
  }

  revalidatePath(`/zaci/${id}`);
  revalidatePath("/zaci");
  revalidatePath("/");

  // Po uložení zpátky na kartu. Zůstat ve formuláři nedává smysl —
  // člověk chce vidět výsledek, ne prázdné potvrzení.
  redirect(`/zaci/${id}`);
}

