"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujSpravce } from "@/lib/relace";
import { ucitele } from "@/db/schema";
import { noveHesloUctu, uzivatelAutoskoly, zalozUcet, zrusUcet } from "@/lib/ucty";
import { PLATNOST_DNU, vytvorPozvanku } from "@/lib/pozvanky";
import { adresaAplikace } from "@/lib/env";

/**
 * Přihlášení pro učitele — zakládá a ruší ho správce.
 *
 * Vygenerované heslo se vrátí sem a ukáže se jednou. Nikam se neukládá,
 * v databázi je jen jeho otisk. Když ho správce zapomene předat, udělá
 * se nové — přečíst to staré nejde ani jemu.
 *
 * Pozor na pořadí u rušení: propojení na učitele se ruší uvnitř
 * proAutoskolu, tedy s nastaveným kontextem autoškoly. Zápis do evidence
 * bez něj databáze odmítne (historie změn by neprošla pravidlem) — a
 * kdyby se učitel odpojil až cizím klíčem při mazání uživatele, spadlo
 * by to.
 */
export type StavUctu = {
  chyba?: string;
  /** Vygenerované heslo. Ukazuje se jednou a pak už ho nikdo nepřečte. */
  heslo?: string;
  /** Odkaz na pozvánku. Taky jen jednou — v databázi je jen jeho otisk. */
  odkaz?: string;
  /** Kolik dní odkaz platí, aby to šlo napsat do zprávy. */
  dnu?: number;
  hotovo?: boolean;
};

function id(f: FormData, klic: string): string | null {
  const v = f.get(klic);
  return typeof v === "string" && v !== "" ? v : null;
}

export async function vytvorPrihlaseni(
  _p: StavUctu,
  f: FormData,
): Promise<StavUctu> {
  const kdo = await vyzadujSpravce();

  const ucitelId = id(f, "ucitelId");
  if (!ucitelId) return { chyba: "Chybí, komu se má přihlášení vytvořit." };

  const ucitel = await proAutoskolu(kdo, async (tx) => {
    const [u] = await tx
      .select()
      .from(ucitele)
      .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id)))
      .limit(1);
    return u ?? null;
  });

  if (!ucitel) return { chyba: "Učitel nenalezen." };
  if (ucitel.userId) return { chyba: "Tenhle učitel už přihlášení má." };
  if (!ucitel.email) {
    return {
      chyba: "Učitel nemá vyplněný e-mail. Doplň ho v úpravě — přihlašuje se jím.",
    };
  }

  let ucet;
  try {
    ucet = await zalozUcet({
      tenantId: kdo.autoskola.id,
      jmeno: `${ucitel.jmeno} ${ucitel.prijmeni}`,
      email: ucitel.email,
      role: "ucitel",
    });
  } catch (e) {
    return { chyba: e instanceof Error ? e.message : "Účet se nepodařilo založit." };
  }

  try {
    await proAutoskolu(kdo, (tx) =>
      tx
        .update(ucitele)
        .set({ userId: ucet.userId, updatedAt: new Date() })
        .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id))),
    );
  } catch (e) {
    // Propojení neprošlo — účet by zůstal viset bez učitele. Uklidit.
    await zrusUcet(ucet.userId);
    return {
      chyba:
        e instanceof Error
          ? `Účet se nepodařilo propojit s učitelem: ${e.message}`
          : "Účet se nepodařilo propojit s učitelem.",
    };
  }

  revalidatePath("/ucitele");
  return { heslo: ucet.heslo, hotovo: true };
}

export async function noveHeslo(_p: StavUctu, f: FormData): Promise<StavUctu> {
  const kdo = await vyzadujSpravce();

  const ucitelId = id(f, "ucitelId");
  if (!ucitelId) return { chyba: "Chybí, komu se má heslo změnit." };

  const ucitel = await proAutoskolu(kdo, async (tx) => {
    const [u] = await tx
      .select()
      .from(ucitele)
      .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id)))
      .limit(1);
    return u ?? null;
  });

  if (!ucitel?.userId) return { chyba: "Učitel nemá přihlášení." };

  // Že účet patří téhle autoškole, se ověřuje zvlášť: tabulka uživatelů
  // izolaci po autoškolách nemá, tam ji musí zkontrolovat kód.
  const ucet = await uzivatelAutoskoly(ucitel.userId, kdo.autoskola.id);
  if (!ucet) return { chyba: "Účet nepatří téhle autoškole." };

  try {
    const heslo = await noveHesloUctu(ucet.id);
    revalidatePath("/ucitele");
    return { heslo, hotovo: true };
  } catch (e) {
    return { chyba: e instanceof Error ? e.message : "Heslo se nepodařilo změnit." };
  }
}

export async function zrusPrihlaseni(
  _p: StavUctu,
  f: FormData,
): Promise<StavUctu> {
  const kdo = await vyzadujSpravce();

  const ucitelId = id(f, "ucitelId");
  if (!ucitelId) return { chyba: "Chybí, komu se má přihlášení zrušit." };

  const ucitel = await proAutoskolu(kdo, async (tx) => {
    const [u] = await tx
      .select()
      .from(ucitele)
      .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id)))
      .limit(1);
    return u ?? null;
  });

  if (!ucitel?.userId) return { chyba: "Učitel přihlášení nemá." };

  const ucet = await uzivatelAutoskoly(ucitel.userId, kdo.autoskola.id);
  if (!ucet) return { chyba: "Účet nepatří téhle autoškole." };

  if (ucet.id === kdo.uzivatelId) {
    return { chyba: "Vlastní přihlášení si takhle zrušit nemůžeš." };
  }

  // Nejdřív odpojit (s kontextem autoškoly), teprve pak smazat účet.
  await proAutoskolu(kdo, (tx) =>
    tx
      .update(ucitele)
      .set({ userId: null, updatedAt: new Date() })
      .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id))),
  );

  await zrusUcet(ucet.id);

  revalidatePath("/ucitele");
  return { hotovo: true };
}

/**
 * Pozvánka: odkaz, na kterém si učitel zvolí heslo sám.
 *
 * Lepší než poslat heslo. Heslo by zůstalo ležet v jeho poště napořád;
 * tenhle odkaz je jednorázový, vyprší a po použití je mrtvý. Odesílá ho
 * správce sám — poštu aplikace zatím neumí a předstírat to nebudeme.
 */
export async function pozvankaProUcitele(
  _p: StavUctu,
  f: FormData,
): Promise<StavUctu> {
  const kdo = await vyzadujSpravce();

  const ucitelId = id(f, "ucitelId");
  if (!ucitelId) return { chyba: "Chybí, koho pozvat." };

  const ucitel = await proAutoskolu(kdo, async (tx) => {
    const [u] = await tx
      .select()
      .from(ucitele)
      .where(and(eq(ucitele.id, ucitelId), eq(ucitele.tenantId, kdo.autoskola.id)))
      .limit(1);
    return u ?? null;
  });

  if (!ucitel) return { chyba: "Učitel nenalezen." };
  if (ucitel.userId) return { chyba: "Tenhle učitel už přihlášení má." };
  if (!ucitel.email) {
    return {
      chyba: "Učitel nemá vyplněný e-mail. Doplň ho v úpravě — přihlašuje se jím.",
    };
  }

  try {
    const token = await vytvorPozvanku(kdo, ucitelId);
    revalidatePath("/ucitele");
    return {
      odkaz: `${adresaAplikace()}/pozvanka/${token}`,
      dnu: PLATNOST_DNU,
      hotovo: true,
    };
  } catch (e) {
    return {
      chyba: e instanceof Error ? e.message : "Pozvánku se nepodařilo vytvořit.",
    };
  }
}
