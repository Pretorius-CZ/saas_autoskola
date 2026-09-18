import { nactiRozvrh, nazevTerminu } from "../data";
import { kalendar } from "@/lib/ics";

/**
 * Rozvrh žáka jako soubor pro kalendář.
 *
 * Dá se stáhnout jednou, nebo si ho jde v Google kalendáři přidat
 * odkazem — pak se termíny aktualizují samy. Proto je odpověď zásadně
 * bez ukládání do mezipaměti: starý rozvrh je horší než žádný.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _pozadavek: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await nactiRozvrh(token);

  if (!data) {
    return new Response("Rozvrh nenalezen.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const text = kalendar(
    `Autoškola — ${data.jmeno} ${data.prijmeni}`,
    data.terminy.map((t) => ({
      id: t.id,
      zacatek: t.zacatek,
      delkaMinut: t.delkaMinut,
      nazev: nazevTerminu(t, data.skupina),
      popis: [t.ucitel ? `Učitel: ${t.ucitel}` : null, t.tema]
        .filter(Boolean)
        .join("\n"),
      misto: t.misto,
    })),
  );

  return new Response(text, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="autoskola.ics"',
      "cache-control": "no-store",
    },
  });
}
