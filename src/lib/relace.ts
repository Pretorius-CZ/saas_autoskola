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

/**
 * Zavolej na začátku každé chráněné stránky.
 *
 * Nespoléhá na to, že v prohlížeči leží nějaká cookie — pokaždé se ptá
 * databáze, jestli je relace pořád platná. Je to o jeden dotaz dražší
 * a o jednu třídu chyb bezpečnější.
 */
export async function vyzadujPrihlaseni(): Promise<Prihlaseny> {
  const relace = await auth.api.getSession({ headers: await headers() });

  if (!relace?.user) {
    redirect("/prihlaseni");
  }

  const db = getDb();
  if (!db) {
    throw new Error("Databáze není dostupná.");
  }

  const uzivatel = relace.user as typeof relace.user & {
    tenantId?: string | null;
    role?: string | null;
  };

  if (!uzivatel.tenantId) {
    // Účet existuje, ale nepatří žádné autoškole. Stát se to může jen
    // u účtu založeného mimo běžný postup — dovnitř ho pustit nesmíme.
    redirect("/bez-autoskoly");
  }

  const [autoskola] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, uzivatel.tenantId))
    .limit(1);

  if (!autoskola) {
    redirect("/bez-autoskoly");
  }

  return {
    uzivatelId: uzivatel.id,
    jmeno: uzivatel.name,
    email: uzivatel.email,
    role: uzivatel.role ?? "ucitel",
    autoskola,
  };
}
