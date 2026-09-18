"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { podpisy, terminy, ucitele } from "@/db/schema";
import { NEJVIC_BODU, kresbaZTextu, pocetBodu } from "@/lib/podpis-typy";
import { procNe } from "@/lib/jizda-okno";

/**
 * Průběh jízdy očima učitele: podpis → zahájení → ukončení.
 *
 * Tři kroky, ne jeden. Podpis znamená, že žák přišel. Zahájení, že se
 * vyjelo a s jakým stavem tachometru. Ukončení, že se vrátilo — a teprve
 * ono dělá z naplánované jízdy proběhlou. Podpis sám o sobě neznamená,
 * že se jelo.
 *
 * Pořadí se hlídá tady, ne jen schováváním tlačítek. Obrazovka může
 * zůstat otevřená na starém stavu a poslat krok, který už neplatí.
 */
export type StavKroku = { chyba?: string; hotovo?: boolean };

type Transakce = Parameters<Parameters<typeof proAutoskolu>[1]>[0];

/**
 * Výsledek hledání termínu.
 *
 * Rozlišuje se podle `ok`, ne podle toho, jestli je v objektu klíč
 * "chyba". Kontrola přítomnosti klíče si u typů nechává zadní vrátka a
 * do návratové hodnoty se pak přimíchá undefined — což sestavení
 * odmítlo, a právem.
 */
type Nalezeno =
  | { ok: false; chyba: string }
  | {
      ok: true;
      ucitel: { id: string };
      t: typeof terminy.$inferSelect;
    };

/** Termín, který přihlášený učitel opravdu má — a je to jízda. */
async function mojeJizda(
  tx: Transakce,
  tenantId: string,
  uzivatelId: string,
  terminId: string,
): Promise<Nalezeno> {
  const [ucitel] = await tx
    .select({ id: ucitele.id })
    .from(ucitele)
    .where(and(eq(ucitele.tenantId, tenantId), eq(ucitele.userId, uzivatelId)))
    .limit(1);

  if (!ucitel) return { ok: false, chyba: "Tvůj účet není propojený s učitelem." };

  const [t] = await tx
    .select()
    .from(terminy)
    .where(
      and(
        eq(terminy.id, terminId),
        eq(terminy.tenantId, tenantId),
        eq(terminy.ucitelId, ucitel.id),
      ),
    )
    .limit(1);

  if (!t) return { ok: false, chyba: "Termín nenalezen." };
  if (t.druh !== "jizda") return { ok: false, chyba: "Tohle není jízda." };
  if (t.stav === "zruseno") return { ok: false, chyba: "Jízda je zrušená." };

  // Zapisovat jde jen kolem naplánovaného času. Kontrola je tady, ve
  // společném místě — schovaná tlačítka na obrazovce nestačí, ta může
  // zůstat otevřená od včerejška.
  const pozde = procNe(t.zacatek, t.delkaMinut);
  if (pozde) return { ok: false, chyba: pozde };

  return { ok: true, ucitel, t };
}

/** Stav tachometru z formuláře. Celé kilometry, nic jiného. */
function kilometry(f: FormData): number | null {
  const v = f.get("km");
  if (typeof v !== "string") return null;

  const cisty = v.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}$/.test(cisty)) return null;

  return Number(cisty);
}

export async function ulozPodpis(
  terminId: string,
  kresbaText: string,
): Promise<StavKroku> {
  const kdo = await vyzadujPrihlaseni();

  // Data z prohlížeče se kontrolují tady, ne až v databázi.
  const kresba = kresbaZTextu(kresbaText);
  if (!kresba || kresba.tahy.length === 0) return { chyba: "Podpis je prázdný." };
  if (pocetBodu(kresba) > NEJVIC_BODU) return { chyba: "Podpis je příliš dlouhý." };

  const chyba = await proAutoskolu(kdo, async (tx): Promise<string | null> => {
    const v = await mojeJizda(tx, kdo.autoskola.id, kdo.uzivatelId, terminId);
    if (!v.ok) return v.chyba;

    const { t, ucitel } = v;
    if (!t.vycvikId) return "U termínu není žák.";

    const [uz] = await tx
      .select({ id: podpisy.id })
      .from(podpisy)
      .where(
        and(
          eq(podpisy.tenantId, kdo.autoskola.id),
          eq(podpisy.terminId, terminId),
          eq(podpisy.vycvikId, t.vycvikId),
        ),
      )
      .limit(1);

    if (uz) return "Tahle jízda už je podepsaná.";

    await tx.insert(podpisy).values({
      tenantId: kdo.autoskola.id,
      terminId,
      vycvikId: t.vycvikId,
      ucitelId: ucitel.id,
      kresba: kresbaText,
    });

    return null;
  });

  return dokonci(chyba, terminId);
}

export async function zahajJizdu(_p: StavKroku, f: FormData): Promise<StavKroku> {
  const kdo = await vyzadujPrihlaseni();

  const terminId = f.get("terminId");
  if (typeof terminId !== "string") return { chyba: "Chybí termín." };

  const km = kilometry(f);
  if (km === null) {
    return { chyba: "Zapiš stav tachometru — celé kilometry, jen číslice." };
  }

  const chyba = await proAutoskolu(kdo, async (tx): Promise<string | null> => {
    const v = await mojeJizda(tx, kdo.autoskola.id, kdo.uzivatelId, terminId);
    if (!v.ok) return v.chyba;

    const { t } = v;
    if (t.zahajenoKdy) return "Jízda už je zahájená.";
    if (!t.vycvikId) return "U termínu není žák.";

    const [podpis] = await tx
      .select({ id: podpisy.id })
      .from(podpisy)
      .where(
        and(eq(podpisy.tenantId, kdo.autoskola.id), eq(podpisy.terminId, terminId)),
      )
      .limit(1);

    if (!podpis) return "Nejdřív se musí žák podepsat.";

    await tx
      .update(terminy)
      .set({ zahajenoKdy: new Date(), kmZacatek: km, updatedAt: new Date() })
      .where(and(eq(terminy.id, terminId), eq(terminy.tenantId, kdo.autoskola.id)));

    return null;
  });

  return dokonci(chyba, terminId);
}

export async function ukonciJizdu(_p: StavKroku, f: FormData): Promise<StavKroku> {
  const kdo = await vyzadujPrihlaseni();

  const terminId = f.get("terminId");
  if (typeof terminId !== "string") return { chyba: "Chybí termín." };

  const km = kilometry(f);
  if (km === null) {
    return { chyba: "Zapiš stav tachometru — celé kilometry, jen číslice." };
  }

  const chyba = await proAutoskolu(kdo, async (tx): Promise<string | null> => {
    const v = await mojeJizda(tx, kdo.autoskola.id, kdo.uzivatelId, terminId);
    if (!v.ok) return v.chyba;

    const { t } = v;
    if (!t.zahajenoKdy) return "Jízda ještě není zahájená.";
    if (t.ukoncenoKdy) return "Jízda už je ukončená.";

    if (t.kmZacatek !== null && km < t.kmZacatek) {
      return `Na konci nemůže být míň než na začátku (${t.kmZacatek} km).`;
    }

    await tx
      .update(terminy)
      .set({
        ukoncenoKdy: new Date(),
        kmKonec: km,
        // Teprve ukončená jízda je proběhlá.
        stav: "probehlo",
        updatedAt: new Date(),
      })
      .where(and(eq(terminy.id, terminId), eq(terminy.tenantId, kdo.autoskola.id)));

    return null;
  });

  return dokonci(chyba, terminId);
}

function dokonci(chyba: string | null, terminId: string): StavKroku {
  if (chyba) return { chyba };

  revalidatePath(`/ucitel/${terminId}`);
  revalidatePath("/ucitel");
  revalidatePath("/sestavy/kniha-jizd");
  revalidatePath("/zaci");
  return { hotovo: true };
}
