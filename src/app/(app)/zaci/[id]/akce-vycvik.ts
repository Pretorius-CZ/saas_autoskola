"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vycviky } from "@/db/schema";
import { formatDatum } from "@/lib/datum";
import { MILNIKY, type Milnik } from "@/lib/milniky-typy";

type Data = Record<Milnik, string | null>;

/**
 * Stav výcviku se neukládá, odvozuje se z dat.
 *
 * Kdyby si stav a data žila vlastním životem, dřív nebo později by si
 * odporovaly: výcvik „ve výcviku" s vyplněným datem ukončení.
 */
function odvodStav(d: Data): string {
  if (d.datumDokonceni) return "dokonceno";
  if (d.datumPrvniZkousky || d.datumPrihlasky) return "zkousky";
  if (d.datumUkonceni) return "ukonceno";
  if (d.datumZahajeni) return "vycvik";
  return "zadost";
}

/** Co po čem musí následovat. */
const PORADI: [Milnik, Milnik, string][] = [
  ["datumZahajeni", "datumUkonceni", "Ukončení výcviku nemůže být dřív než zahájení."],
  ["datumUkonceni", "datumPrihlasky", "Přihláška ke zkoušce nemůže být dřív než ukončení výcviku."],
  ["datumPrvniZkousky", "datumDokonceni", "Dokončení nemůže být dřív než první zkouška."],
];

/**
 * Uloží jedno datum průběhu.
 *
 * Schválně po jednom: člověk klikne na datum, přepíše ho a jde dál.
 * Ukládat celý formulář by znamenalo, že si musí pamatovat, že má ještě
 * někde dole zmáčknout tlačítko.
 */
export async function ulozMilnik(
  id: string,
  pole: Milnik,
  hodnota: string | null,
): Promise<{ chyba?: string }> {
  const kdo = await vyzadujPrihlaseni();

  if (!MILNIKY.includes(pole)) return { chyba: "Neznámý údaj." };

  if (hodnota !== null && !/^\d{4}-\d{2}-\d{2}$/.test(hodnota)) {
    return { chyba: "Neplatné datum." };
  }

  const vysledek = await proAutoskolu(kdo, async (tx) => {
    const [v] = await tx
      .select()
      .from(vycviky)
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!v) return { chyba: "Výcvik nenalezen." };

    const nova: Data = {
      datumZahajeni: v.datumZahajeni,
      datumUkonceni: v.datumUkonceni,
      datumPrihlasky: v.datumPrihlasky,
      datumPrvniZkousky: v.datumPrvniZkousky,
      datumDokonceni: v.datumDokonceni,
    };
    nova[pole] = hodnota;

    for (const [drive, pozdeji, zprava] of PORADI) {
      const a = nova[drive];
      const b = nova[pozdeji];
      if (a && b && b < a) return { chyba: zprava };
    }

    // Výcvik nemůže začít dřív, než byla podaná žádost.
    if (nova.datumZahajeni && v.datumPodaniZadosti && nova.datumZahajeni < v.datumPodaniZadosti) {
      return {
        chyba: `Zahájení nemůže být dřív než podání žádosti (${formatDatum(v.datumPodaniZadosti)}).`,
      };
    }

    // Zrušený výcvik stav nepřepisujeme — zůstává zrušený, dokud ho
    // někdo vědomě neobnoví.
    const stav = v.stav === "zruseno" ? "zruseno" : odvodStav(nova);

    await tx
      .update(vycviky)
      .set({ ...nova, stav, updatedAt: new Date() })
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)));

    return {};
  });

  if (vysledek.chyba) return vysledek;

  revalidatePath(`/zaci/${id}`);
  revalidatePath("/zaci");
  revalidatePath("/");

  return {};
}

/** Zrušení a obnovení výcviku. Záznam zůstává v evidenci. */
export async function zmenZruseni(id: string, zrusit: boolean) {
  const kdo = await vyzadujPrihlaseni();

  await proAutoskolu(kdo, async (tx) => {
    const [v] = await tx
      .select()
      .from(vycviky)
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);
    if (!v) return;

    const stav = zrusit
      ? "zruseno"
      : odvodStav({
          datumZahajeni: v.datumZahajeni,
          datumUkonceni: v.datumUkonceni,
          datumPrihlasky: v.datumPrihlasky,
          datumPrvniZkousky: v.datumPrvniZkousky,
          datumDokonceni: v.datumDokonceni,
        });

    await tx
      .update(vycviky)
      .set({ stav, updatedAt: new Date() })
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)));
  });

  revalidatePath(`/zaci/${id}`);
  revalidatePath("/zaci");
  revalidatePath("/");
}
