"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { terminy, ucast, vycviky } from "@/db/schema";
import { okamzik } from "@/lib/cas";

export type StavTerminu = {
  chyba?: string;
  /** Které pole zvýraznit. */
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

/**
 * Nejvyšší denní počet minut jízdy na jednoho žáka.
 *
 * § 27 odst. 2: nejvýše čtyři vyučovací hodiny denně, a u skupin AM, A1,
 * A2, A, B1 a B nejvýše dvě v první a druhé etapě. Etapy zatím neevidujeme,
 * takže tvrdě bráníme až čtyřem hodinám a na dvě upozorňujeme.
 */
const DEN_MAXIMUM = 4 * 45;

export async function ulozTermin(
  _predchozi: StavTerminu,
  f: FormData,
): Promise<StavTerminu> {
  const kdo = await vyzadujPrihlaseni();

  const hodnoty: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string") hodnoty[k] = v;

  /** Chyba, která si s sebou nese všechno, co už bylo vyplněné. */
  const chybne = (zprava: string, pole?: string): StavTerminu => ({
    chyba: zprava,
    pole,
    hodnoty,
  });

  const druh = text(f, "druh") ?? "jizda";
  const datum = text(f, "datum");
  const cas = text(f, "cas");
  const delka = Number(text(f, "delkaMinut") ?? "90");

  if (!datum || !cas) return chybne("Vyplň datum a čas.", datum ? "cas" : "datum");
  if (!Number.isInteger(delka) || delka < 15 || delka > 480) {
    return chybne("Délka musí být mezi 15 a 480 minutami.", "delkaMinut");
  }

  const zacatek = okamzik(datum, cas);
  if (!zacatek) return chybne("Neplatné datum nebo čas.", "datum");
  const konec = new Date(zacatek.getTime() + delka * 60_000);

  const ucitelId = text(f, "ucitelId");
  const vozidloId = text(f, "vozidloId");
  const kurzId = text(f, "kurzId");
  const vycvikId = text(f, "vycvikId");

  if (druh === "teorie" && !kurzId) return chybne("U teorie vyber kurz.", "kurzId");
  if (druh === "jizda" && !vycvikId) return chybne("U jízdy vyber žáka.", "vycvikId");
  if (druh === "jizda" && !ucitelId) return chybne("U jízdy vyber učitele.", "ucitelId");

  const potiz = await proAutoskolu(kdo, async (tx): Promise<{ zprava: string; pole?: string } | null> => {
    // --- kolize -------------------------------------------------------
    // Překrývají se dva termíny, když jeden začne dřív, než druhý skončí.
    const prekryv = and(
      eq(terminy.tenantId, kdo.autoskola.id),
      ne(terminy.stav, "zruseno"),
      lt(terminy.zacatek, konec),
      sql`${terminy.zacatek} + make_interval(mins => ${terminy.delkaMinut}) > ${zacatek}`,
    );

    const soubezne = await tx
      .select({
        id: terminy.id,
        ucitelId: terminy.ucitelId,
        vozidloId: terminy.vozidloId,
        vycvikId: terminy.vycvikId,
        kurzId: terminy.kurzId,
      })
      .from(terminy)
      .where(prekryv);

    if (ucitelId && soubezne.some((t) => t.ucitelId === ucitelId)) {
      return { zprava: "Učitel už v tu dobu někde je.", pole: "ucitelId" };
    }
    if (vozidloId && soubezne.some((t) => t.vozidloId === vozidloId)) {
      return { zprava: "Vozidlo je v tu dobu obsazené.", pole: "vozidloId" };
    }
    if (vycvikId && soubezne.some((t) => t.vycvikId === vycvikId)) {
      return { zprava: "Žák už v tu dobu jinde jezdí.", pole: "vycvikId" };
    }
    if (kurzId && soubezne.some((t) => t.kurzId === kurzId)) {
      return { zprava: "Kurz už v tu dobu má jiný termín.", pole: "kurzId" };
    }

    // --- denní strop jízd ---------------------------------------------
    if (druh === "jizda" && vycvikId) {
      const zacatekDne = new Date(zacatek);
      zacatekDne.setHours(0, 0, 0, 0);
      const konecDne = new Date(zacatekDne);
      konecDne.setDate(konecDne.getDate() + 1);

      const [soucet] = await tx
        .select({ minut: sql<number>`coalesce(sum(${terminy.delkaMinut}), 0)::int` })
        .from(terminy)
        .where(
          and(
            eq(terminy.tenantId, kdo.autoskola.id),
            eq(terminy.vycvikId, vycvikId),
            eq(terminy.druh, "jizda"),
            ne(terminy.stav, "zruseno"),
            gte(terminy.zacatek, zacatekDne),
            lt(terminy.zacatek, konecDne),
          ),
        );

      if ((soucet?.minut ?? 0) + delka > DEN_MAXIMUM) {
        return {
          zprava: `Žák by ten den měl ${((soucet?.minut ?? 0) + delka) / 45} vyučovacích hodin jízdy. Zákon dovoluje nejvýš čtyři (§ 27).`,
          pole: "delkaMinut",
        };
      }
    }

    // --- zápis --------------------------------------------------------
    const [novy] = await tx
      .insert(terminy)
      .values({
        tenantId: kdo.autoskola.id,
        druh,
        zacatek,
        delkaMinut: delka,
        ucitelId,
        vozidloId: druh === "jizda" ? vozidloId : null,
        kurzId: druh === "teorie" ? kurzId : null,
        vycvikId: druh === "jizda" ? vycvikId : null,
        tema: text(f, "tema"),
        misto: text(f, "misto"),
        poznamka: text(f, "poznamka"),
      })
      .returning({ id: terminy.id });

    // U teorie rovnou založíme docházku pro všechny žáky kurzu.
    // Bez toho by se po hodině nedalo odškrtávat, kdo přišel.
    if (druh === "teorie" && kurzId) {
      const zaciKurzu = await tx
        .select({ id: vycviky.id })
        .from(vycviky)
        .where(and(eq(vycviky.tenantId, kdo.autoskola.id), eq(vycviky.kurzId, kurzId)));

      if (zaciKurzu.length > 0) {
        await tx.insert(ucast).values(
          zaciKurzu.map((z) => ({
            tenantId: kdo.autoskola.id,
            terminId: novy.id,
            vycvikId: z.id,
          })),
        );
      }
    }

    return null;
  });

  if (potiz) return chybne(potiz.zprava, potiz.pole);

  revalidatePath("/kalendar");
  revalidatePath("/zaci");
  return { hotovo: true };
}

/** Zrušení termínu. Zůstává v evidenci, jen označený. */
export async function zrusTermin(id: string) {
  const kdo = await vyzadujPrihlaseni();

  await proAutoskolu(kdo, (tx) =>
    tx
      .update(terminy)
      .set({ stav: "zruseno", updatedAt: new Date() })
      .where(and(eq(terminy.id, id), eq(terminy.tenantId, kdo.autoskola.id))),
  );

  revalidatePath("/kalendar");
}
