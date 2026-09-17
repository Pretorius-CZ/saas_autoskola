"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { kurzy, vycviky } from "@/db/schema";
import { MAX_VE_SKUPINE_ISP } from "@/lib/osnova";

export type StavKurzu = {
  chyba?: string;
  pole?: string;
  /** Co bylo vyplněné — aby se při chybě nemuselo psát znovu. */
  hodnoty?: Record<string, string>;
  hotovo?: boolean;
};

function text(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  if (typeof v !== "string") return null;
  const o = v.trim();
  return o === "" ? null : o;
}

function vsechnyHodnoty(f: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function zalozKurz(_p: StavKurzu, f: FormData): Promise<StavKurzu> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const nazev = text(f, "nazev");
  if (!nazev) return { chyba: "Vyplň název kurzu.", pole: "nazev", hodnoty };

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

/** Úprava už založeného kurzu. */
export async function upravKurz(_p: StavKurzu, f: FormData): Promise<StavKurzu> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const id = text(f, "id");
  if (!id) return { chyba: "Chybí, který kurz se má upravit." };

  const nazev = text(f, "nazev");
  if (!nazev) return { chyba: "Vyplň název kurzu.", pole: "nazev", hodnoty };

  await proAutoskolu(kdo, (tx) =>
    tx
      .update(kurzy)
      .set({
        nazev,
        skupina: text(f, "skupina") ?? "B",
        datumZahajeni: text(f, "datumZahajeni"),
        poznamka: text(f, "poznamka"),
        aktivni: f.get("aktivni") === "ano",
        updatedAt: new Date(),
      })
      .where(and(eq(kurzy.id, id), eq(kurzy.tenantId, kdo.autoskola.id))),
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

  // Výuka se vede individuálním studijním plánem a ten dovoluje
  // nejvýš pět lidí ve skupině (§ 18 odst. 3).
  if (vybrani.length > MAX_VE_SKUPINE_ISP) {
    return {
      chyba: `Do kurzu se vejde nejvýš ${MAX_VE_SKUPINE_ISP} žáků — individuální studijní plán víc nedovoluje (§ 18 odst. 3). Vybráno ${vybrani.length}.`,
    };
  }

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
