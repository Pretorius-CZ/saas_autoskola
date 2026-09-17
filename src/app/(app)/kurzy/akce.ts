"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { kurzy, vycviky } from "@/db/schema";

export type StavKurzu = { chyba?: string; hotovo?: boolean };

function text(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  if (typeof v !== "string") return null;
  const o = v.trim();
  return o === "" ? null : o;
}

export async function zalozKurz(_p: StavKurzu, f: FormData): Promise<StavKurzu> {
  const kdo = await vyzadujPrihlaseni();

  const nazev = text(f, "nazev");
  if (!nazev) return { chyba: "Vyplň název kurzu." };

  await proAutoskolu(kdo, (tx) =>
    tx.insert(kurzy).values({
      tenantId: kdo.autoskola.id,
      nazev,
      skupina: text(f, "skupina") ?? "B",
      datumZahajeni: text(f, "datumZahajeni"),
      poznamka: text(f, "poznamka"),
    }),
  );

  revalidatePath("/kurzy");
  revalidatePath("/kalendar");
  return { hotovo: true };
}

/**
 * Přiřazení žáků do kurzu.
 *
 * Schválně se ukládá celý seznam najednou, ne po jednom zaškrtnutí:
 * jinak by se dalo odejít ze stránky uprostřed a polovina žáků by
 * zůstala jinde, než člověk čekal.
 */
export async function ulozSlozeniKurzu(_p: StavKurzu, f: FormData): Promise<StavKurzu> {
  const kdo = await vyzadujPrihlaseni();

  const kurzId = text(f, "kurzId");
  if (!kurzId) return { chyba: "Chybí kurz." };

  const vybrani = f.getAll("vycvikId").filter((v): v is string => typeof v === "string");

  await proAutoskolu(kdo, async (tx) => {
    // nejdřív všechny z tohohle kurzu vyřadit
    await tx
      .update(vycviky)
      .set({ kurzId: null, updatedAt: new Date() })
      .where(and(eq(vycviky.tenantId, kdo.autoskola.id), eq(vycviky.kurzId, kurzId)));

    // a pak zařadit ty zaškrtnuté
    if (vybrani.length > 0) {
      await tx
        .update(vycviky)
        .set({ kurzId, updatedAt: new Date() })
        .where(and(eq(vycviky.tenantId, kdo.autoskola.id), inArray(vycviky.id, vybrani)));
    }
  });

  revalidatePath("/kurzy");
  revalidatePath("/zaci");
  return { hotovo: true };
}
