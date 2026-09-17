import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { vycviky, zaci } from "@/db/schema";
import { desifruj } from "@/lib/sifrovani";
import { vyplnZadost } from "@/lib/zadost-pdf";

export const dynamic = "force-dynamic";

/** Bez diakritiky a mezer — ať se soubor jmenuje stejně na všech počítačích. */
function bezpecnyNazev(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const [zaznam] = await proAutoskolu(kdo.autoskola.id, (tx) =>
    tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1),
  );

  if (!zaznam) {
    return new Response("Výcvik nenalezen.", { status: 404 });
  }

  const { v, z } = zaznam;

  const rodneCislo = desifruj(z.rodneCisloSifr);

  const pdf = await vyplnZadost({
    skupina: v.skupina,
    drzitelSkupin: v.stavajiciSkupiny,
    cisloRidicskeho: v.ridicskyPrukazCislo,
    jmeno: z.jmeno,
    prijmeni: z.prijmeni,
    titul: z.titul,
    datumNarozeni: z.datumNarozeni,
    mistoNarozeni: z.mistoNarozeni,
    // Na tiskopise se rodné číslo píše s lomítkem, jak je zvykem.
    rodneCislo:
      rodneCislo && rodneCislo.length === 10
        ? `${rodneCislo.slice(0, 6)}/${rodneCislo.slice(6)}`
        : rodneCislo,
    statniPrislusnost: z.statniPrislusnost,
    dokladCislo: z.dokladCislo,
    telefon: z.telefon,
    ulice: z.ulice,
    mesto: z.mesto,
    psc: z.psc,
    orpBydliste: v.orpBydliste,
  });

  const nazev = `zadost-${v.evidencniCislo}-${bezpecnyNazev(z.prijmeni)}.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // inline = otevře se v prohlížeči, odkud se dá rovnou tisknout
      "Content-Disposition": `inline; filename="${nazev}"`,
      "Cache-Control": "no-store",
    },
  });
}
