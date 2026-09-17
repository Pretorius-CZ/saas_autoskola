import { and, asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import FormularPrijeti from "./formular";

export const dynamic = "force-dynamic";

export default async function NovyZak() {
  const kdo = await vyzadujPrihlaseni();

  const seznam = await proAutoskolu(kdo.autoskola.id, (tx) =>
    tx
      .select({ id: ucitele.id, jmeno: ucitele.jmeno, prijmeni: ucitele.prijmeni })
      .from(ucitele)
      .where(and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.aktivni, true)))
      .orderBy(asc(ucitele.prijmeni)),
  );

  return (
    <main>
      <h1 className="text-lg font-semibold">Přijetí žáka</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pořadí polí odpovídá tiskopisu žádosti. Hvězdička znamená povinné.
      </p>

      <div className="mt-4">
        <FormularPrijeti ucitele={seznam} />
      </div>
    </main>
  );
}
