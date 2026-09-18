"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { poznamkyKurzu, vycviky } from "@/db/schema";

/**
 * Poznámka k žákovi v třídní knize kurzu.
 *
 * Prázdná poznámka se smaže, ne uloží jako prázdný řádek. Řádek s
 * prázdným textem by v historii vypadal jako by tam poznámka pořád byla.
 */
export type StavPoznamky = { chyba?: string; hotovo?: boolean };

export async function ulozPoznamku(
  _p: StavPoznamky,
  f: FormData,
): Promise<StavPoznamky> {
  const kdo = await vyzadujPrihlaseni();

  const kurzId = f.get("kurzId");
  const vycvikId = f.get("vycvikId");
  const text = f.get("poznamka");

  if (typeof kurzId !== "string" || typeof vycvikId !== "string") {
    return { chyba: "Chybí, ke komu poznámka patří." };
  }

  const poznamka = typeof text === "string" ? text.trim() : "";

  const chyba = await proAutoskolu(kdo, async (tx) => {
    // Žák musí do toho kurzu opravdu patřit. Bez téhle kontroly by šlo
    // poslat cizí vycvikId a napsat poznámku někomu jinému.
    const [clen] = await tx
      .select({ id: vycviky.id })
      .from(vycviky)
      .where(
        and(
          eq(vycviky.id, vycvikId),
          eq(vycviky.kurzId, kurzId),
          eq(vycviky.tenantId, kdo.autoskola.id),
        ),
      )
      .limit(1);

    if (!clen) return "Tenhle žák do kurzu nepatří.";

    const [stavajici] = await tx
      .select()
      .from(poznamkyKurzu)
      .where(
        and(
          eq(poznamkyKurzu.tenantId, kdo.autoskola.id),
          eq(poznamkyKurzu.kurzId, kurzId),
          eq(poznamkyKurzu.vycvikId, vycvikId),
        ),
      )
      .limit(1);

    if (poznamka === "") {
      if (stavajici) {
        await tx
          .delete(poznamkyKurzu)
          .where(eq(poznamkyKurzu.id, stavajici.id));
      }
      return null;
    }

    if (!stavajici) {
      await tx.insert(poznamkyKurzu).values({
        tenantId: kdo.autoskola.id,
        kurzId,
        vycvikId,
        poznamka,
      });
      return null;
    }

    // Beze změny nezapisovat — jinak by historie byla plná záznamů
    // o tom, že se nic nestalo.
    if (stavajici.poznamka === poznamka) return null;

    await tx
      .update(poznamkyKurzu)
      .set({ poznamka, updatedAt: new Date() })
      .where(eq(poznamkyKurzu.id, stavajici.id));

    return null;
  });

  if (chyba) return { chyba };

  revalidatePath(`/sestavy/tridni-kniha/${kurzId}`);
  return { hotovo: true };
}
