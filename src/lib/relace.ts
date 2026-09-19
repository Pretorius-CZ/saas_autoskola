import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { tenants, type Tenant } from "@/db/schema";

export type Prihlaseny = {
  uzivatelId: string;
  jmeno: string;
  email: string;
  role: string;
  autoskola: Tenant;
};

export type Kdo =
  | { stav: "nikdo" }
  | { stav: "bezAutoskoly" }
  | { stav: "ok"; kdo: Prihlaseny };

/**
 * Kdo se dívá — zjištěno jednou za vykreslení stránky.
 *
 * `cache` z Reactu si výsledek podrží po dobu jednoho požadavku. Bez toho
 * se ptal layout (kvůli názvu autoškoly a motivu) a stránka pod ním
 * znovu — dvakrát relace, dvakrát dotaz na autoškolu. Při databázi ve
 * vzdáleném regionu to byly stovky milisekund za nic.
 *
 * Nespoléhá na to, že v prohlížeči leží nějaká cookie — pokaždé se ptá
 * databáze, jestli je relace pořád platná. Je to o jeden dotaz dražší
 * a o jednu třídu chyb bezpečnější.
 */
export const zjistiKdo = cache(async (): Promise<Kdo> => {
  const relace = await auth.api.getSession({ headers: await headers() });

  if (!relace?.user) return { stav: "nikdo" };

  const uzivatel = relace.user as typeof relace.user & {
    tenantId?: string | null;
    role?: string | null;
  };

  // Účet bez autoškoly může vzniknout jen mimo běžný postup. Dovnitř ho
  // pustit nesmíme.
  if (!uzivatel.tenantId) return { stav: "bezAutoskoly" };

  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");

  const [autoskola] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, uzivatel.tenantId))
    .limit(1);

  if (!autoskola) return { stav: "bezAutoskoly" };

  return {
    stav: "ok",
    kdo: {
      uzivatelId: uzivatel.id,
      jmeno: uzivatel.name,
      email: uzivatel.email,
      role: uzivatel.role ?? "ucitel",
      autoskola,
    },
  };
});

/** Zavolej na začátku každé chráněné stránky. */
export async function vyzadujPrihlaseni(): Promise<Prihlaseny> {
  const v = await zjistiKdo();

  if (v.stav === "nikdo") redirect("/prihlaseni");
  if (v.stav === "bezAutoskoly") redirect("/bez-autoskoly");

  return v.kdo;
}

/**
 * Obrazovky, které patří správci autoškoly.
 *
 * Učitele nevyhazuje na přihlášení — pošle ho do jeho části aplikace.
 * Přihlášený je, jen sem nepatří.
 */
export async function vyzadujSpravce(): Promise<Prihlaseny> {
  const kdo = await vyzadujPrihlaseni();
  if (kdo.role !== "spravce") redirect("/ucitel");
  return kdo;
}
