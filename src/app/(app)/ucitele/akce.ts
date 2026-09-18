"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { ucitele } from "@/db/schema";

/**
 * Zakládání a úprava učitelů.
 *
 * Mazat se nedá schválně. Učitel je podepsaný pod termíny, které už
 * proběhly — smazat ho by znamenalo přepsat minulost. Kdo skončil, se
 * označí jako neaktivní a přestane se nabízet při plánování.
 */
export type StavUcitele = {
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

/** Co platí pro nového i upravovaného — ať se pravidla nerozejdou. */
function zkontroluj(f: FormData): { chyba: string; pole: string } | null {
  if (!text(f, "jmeno")) return { chyba: "Vyplň jméno.", pole: "jmeno" };
  if (!text(f, "prijmeni")) return { chyba: "Vyplň příjmení.", pole: "prijmeni" };

  const email = text(f, "email");
  if (email && !email.includes("@")) {
    return { chyba: "E-mail nevypadá jako e-mail.", pole: "email" };
  }

  return null;
}

function poleZFormulare(f: FormData) {
  return {
    jmeno: text(f, "jmeno")!,
    prijmeni: text(f, "prijmeni")!,
    email: text(f, "email"),
    telefon: text(f, "telefon"),
    cisloOsvedceni: text(f, "cisloOsvedceni"),
    osvedceniPlatnostDo: text(f, "osvedceniPlatnostDo"),
    zdravotniZpusobilostDo: text(f, "zdravotniZpusobilostDo"),
    skupiny: text(f, "skupiny"),
    bankovniUcet: text(f, "bankovniUcet"),
    poznamka: text(f, "poznamka"),
  };
}

export async function zalozUcitele(
  _p: StavUcitele,
  f: FormData,
): Promise<StavUcitele> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const potiz = zkontroluj(f);
  if (potiz) return { ...potiz, hodnoty };

  await proAutoskolu(kdo, (tx) =>
    tx.insert(ucitele).values({ tenantId: kdo.autoskola.id, ...poleZFormulare(f) }),
  );

  revalidatePath("/ucitele");
  revalidatePath("/kalendar");
  return { hotovo: true };
}

export async function upravUcitele(
  _p: StavUcitele,
  f: FormData,
): Promise<StavUcitele> {
  const kdo = await vyzadujPrihlaseni();
  const hodnoty = vsechnyHodnoty(f);

  const id = text(f, "id");
  if (!id) return { chyba: "Chybí, kterého učitele upravit." };

  const potiz = zkontroluj(f);
  if (potiz) return { ...potiz, hodnoty };

  await proAutoskolu(kdo, (tx) =>
    tx
      .update(ucitele)
      .set({
        ...poleZFormulare(f),
        aktivni: f.get("aktivni") === "ano",
        updatedAt: new Date(),
      })
      .where(and(eq(ucitele.id, id), eq(ucitele.tenantId, kdo.autoskola.id))),
  );

  revalidatePath("/ucitele");
  revalidatePath("/kalendar");
  return { hotovo: true };
}
