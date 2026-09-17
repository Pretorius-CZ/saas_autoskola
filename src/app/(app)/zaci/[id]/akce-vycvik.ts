"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vycviky } from "@/db/schema";

export type StavUlozeni = { chyba?: string; ulozeno?: boolean };

function datum(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v;
}

/**
 * Stav výcviku se neukládá zvlášť — odvozuje se z dat.
 *
 * Kdyby si stav a data žila vlastním životem, dřív nebo později by si
 * odporovaly: výcvik "ve výcviku" s vyplněným datem ukončení. Takhle
 * to nemůže nastat, protože stav je vždycky jen shrnutí toho, co se stalo.
 */
function odvodStav(d: {
  datumZahajeni: string | null;
  datumUkonceni: string | null;
  datumPrihlasky: string | null;
  datumPrvniZkousky: string | null;
  datumDokonceni: string | null;
}): string {
  if (d.datumDokonceni) return "dokonceno";
  if (d.datumPrvniZkousky || d.datumPrihlasky) return "zkousky";
  if (d.datumUkonceni) return "ukonceno";
  if (d.datumZahajeni) return "vycvik";
  return "zadost";
}

export async function ulozMilniky(
  _predchozi: StavUlozeni,
  f: FormData,
): Promise<StavUlozeni> {
  const kdo = await vyzadujPrihlaseni();

  const id = f.get("id");
  if (typeof id !== "string") return { chyba: "Chybí, který výcvik se má uložit." };

  const d = {
    datumZahajeni: datum(f, "datumZahajeni"),
    datumUkonceni: datum(f, "datumUkonceni"),
    datumPrihlasky: datum(f, "datumPrihlasky"),
    datumPrvniZkousky: datum(f, "datumPrvniZkousky"),
    datumDokonceni: datum(f, "datumDokonceni"),
  };

  // Zdravý rozum: konec nemůže být dřív než začátek.
  if (d.datumZahajeni && d.datumUkonceni && d.datumUkonceni < d.datumZahajeni) {
    return { chyba: "Ukončení výcviku nemůže být dřív než zahájení." };
  }
  if (d.datumUkonceni && d.datumPrihlasky && d.datumPrihlasky < d.datumUkonceni) {
    return { chyba: "Přihláška ke zkoušce nemůže být dřív než ukončení výcviku." };
  }
  if (d.datumPrvniZkousky && d.datumDokonceni && d.datumDokonceni < d.datumPrvniZkousky) {
    return { chyba: "Dokončení nemůže být dřív než první zkouška." };
  }

  await proAutoskolu(kdo.autoskola.id, (tx) =>
    tx
      .update(vycviky)
      .set({ ...d, stav: odvodStav(d), updatedAt: new Date() })
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id))),
  );

  revalidatePath(`/zaci/${id}`);
  revalidatePath("/zaci");
  revalidatePath("/");

  return { ulozeno: true };
}
