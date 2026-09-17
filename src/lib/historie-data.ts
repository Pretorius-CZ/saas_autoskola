import { eq, inArray } from "drizzle-orm";
import { kurzy, ucitele, users, vozidla, vycviky, zaci } from "@/db/schema";
import { ODKAZY } from "@/lib/historie-nazvy";
import type { RadekHistorie } from "@/components/historie-tabulka";

/**
 * Z řádků historie vytáhne odkazy a přeloží je na jména.
 *
 * Dělá se to až tady, ne v databázovém pravidle: pravidlo zapisuje syrové
 * hodnoty a nesmí být závislé na tom, jak se zrovna jmenuje kurz. Kdyby
 * se kurz později přejmenoval, v historii chceme vidět jeho dnešní název,
 * ne ten, který měl v době změny.
 */
export async function nactiNazvyOdkazu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  radky: RadekHistorie[],
): Promise<{ nazvy: Map<string, string>; lide: Map<string, string> }> {
  const nazvy = new Map<string, string>();
  const lide = new Map<string, string>();

  const idcka = new Set<string>();
  for (const r of radky) {
    if (!r.pole || !ODKAZY.includes(r.pole)) continue;
    if (r.hodnotaPred) idcka.add(r.hodnotaPred);
    if (r.hodnotaPo) idcka.add(r.hodnotaPo);
  }

  const seznam = [...idcka];

  if (seznam.length > 0) {
    const [u, k, v, vyc] = await Promise.all([
      tx.select({ id: ucitele.id, a: ucitele.jmeno, b: ucitele.prijmeni })
        .from(ucitele)
        .where(inArray(ucitele.id, seznam)),
      tx.select({ id: kurzy.id, a: kurzy.nazev }).from(kurzy).where(inArray(kurzy.id, seznam)),
      tx.select({ id: vozidla.id, a: vozidla.znacka, b: vozidla.rz })
        .from(vozidla)
        .where(inArray(vozidla.id, seznam)),
      tx
        .select({ id: vycviky.id, a: zaci.jmeno, b: zaci.prijmeni })
        .from(vycviky)
        .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
        .where(inArray(vycviky.id, seznam)),
    ]);

    for (const r of u) nazvy.set(r.id, `${r.a} ${r.b}`);
    for (const r of k) nazvy.set(r.id, r.a);
    for (const r of v) nazvy.set(r.id, `${r.a} ${r.b}`);
    for (const r of vyc) nazvy.set(r.id, `${r.a} ${r.b}`);
  }

  const lidiIdcka = [...new Set(radky.map((r) => r.uzivatelId).filter(Boolean))] as string[];
  if (lidiIdcka.length > 0) {
    const l = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, lidiIdcka));
    for (const r of l) lide.set(r.id, r.name);
  }

  return { nazvy, lide };
}
