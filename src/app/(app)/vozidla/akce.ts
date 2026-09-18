"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vozidla } from "@/db/schema";

/**
 * Zakládání a úprava vozidel.
 *
 * Mazat nejde ze stejného důvodu jako u učitelů: vozidlo je zapsané
 * u jízd, které se odjely. Vyřazené se označí jako neaktivní.
 */
export type StavVozidla = {
  chyba?: string;
  pole?: string;
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

function zkontroluj(f: FormData): { chyba: string; pole: string } | null {
  if (!text(f, "znacka")) return { chyba: "Vyplň značku.", pole: "znacka" };
  if (!text(f, "typ")) return { chyba: "Vyplň typ.", pole: "typ" };
  if (!text(f, "rz")) return { chyba: "Vyplň registrační značku.", pole: "rz" };
  return null;
}

function poleZFormulare(f: FormData) {
  // RZ se píše velkými a bez mezer. Sjednotit to tady je lepší než
  // později hledat, proč "1A2 3456" a "1A23456" nejsou totéž.
  const rz = text(f, "rz")!.toUpperCase().replace(/\s+/g, "");

  return {
    znacka: text(f, "znacka")!,
    typ: text(f, "typ")!,
    rz,
    skupina: text(f, "skupina") ?? "B",
    stkDo: text(f, "stkDo"),
    poznamka: text(f, "poznamka"),
  };
}

export async function zalozVozidlo(
  _p: StavVozidla,
  f: FormData,
): Promise<StavVozidla> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const potiz = zkontroluj(f);
  if (potiz) return { ...potiz, hodnoty };

  await proAutoskolu(kdo, (tx) =>
    tx.insert(vozidla).values({ tenantId: kdo.autoskola.id, ...poleZFormulare(f) }),
  );

  revalidatePath("/vozidla");
  revalidatePath("/kalendar");
  return { hotovo: true };
}

export async function upravVozidlo(
  _p: StavVozidla,
  f: FormData,
): Promise<StavVozidla> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const id = text(f, "id");
  if (!id) return { chyba: "Chybí, které vozidlo upravit." };

  const potiz = zkontroluj(f);
  if (potiz) return { ...potiz, hodnoty };

  await proAutoskolu(kdo, (tx) =>
    tx
      .update(vozidla)
      .set({
        ...poleZFormulare(f),
        aktivni: f.get("aktivni") === "ano",
        updatedAt: new Date(),
      })
      .where(and(eq(vozidla.id, id), eq(vozidla.tenantId, kdo.autoskola.id))),
  );

  revalidatePath("/vozidla");
  revalidatePath("/kalendar");
  return { hotovo: true };
}
