import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";

export const dynamic = "force-dynamic";

const pole = [
  { klic: "nazev", popis: "Název autoškoly", napoveda: "Přesně tak, jak je v registraci." },
  { klic: "ico", popis: "IČO" },
  { klic: "cisloRegistrace", popis: "Číslo registrace k provozování autoškoly" },
  { klic: "orpPodani", popis: "Úřad (ORP), kam podáváš hlášení" },
  { klic: "ulice", popis: "Ulice a číslo popisné" },
  { klic: "mesto", popis: "Město" },
  { klic: "psc", popis: "PSČ" },
  { klic: "email", popis: "E-mail" },
  { klic: "telefon", popis: "Telefon" },
] as const;

export default async function Nastaveni() {
  const kdo = await vyzadujPrihlaseni();

  async function ulozit(formData: FormData) {
    "use server";

    const kdoTed = await vyzadujPrihlaseni();
    if (kdoTed.role !== "spravce") {
      throw new Error("Údaje autoškoly smí měnit jen správce.");
    }

    const db = getDb();
    if (!db) throw new Error("Databáze není dostupná.");

    function hodnota(klic: string) {
      const v = formData.get(klic);
      if (typeof v !== "string") return null;
      const orez = v.trim();
      return orez === "" ? null : orez;
    }

    const nazev = hodnota("nazev");
    if (!nazev) throw new Error("Název autoškoly nesmí zůstat prázdný.");

    await db
      .update(tenants)
      .set({
        nazev,
        ico: hodnota("ico"),
        cisloRegistrace: hodnota("cisloRegistrace"),
        orpPodani: hodnota("orpPodani"),
        ulice: hodnota("ulice"),
        mesto: hodnota("mesto"),
        psc: hodnota("psc"),
        email: hodnota("email"),
        telefon: hodnota("telefon"),
        updatedAt: new Date(),
      })
      // Nikdy ne "update tenants set ..." bez podmínky. Tahle řádka je důvod,
      // proč jedna překlep v budoucnu nepřepíše všechny autoškoly naráz.
      .where(eq(tenants.id, kdoTed.autoskola.id));

    revalidatePath("/", "layout");
  }

  const jeSpravce = kdo.role === "spravce";

  return (
    <main>
      <h1 className="text-lg font-semibold">Nastavení autoškoly</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tyhle údaje se budou propisovat do hlášení pro úřad. Vyplň je přesně tak,
        jak jsou v registraci.
      </p>

      <form action={ulozit} className="mt-6 space-y-4">
        {pole.map((p) => (
          <label key={p.klic} className="block">
            <span className="text-sm text-neutral-500">{p.popis}</span>
            <input
              name={p.klic}
              defaultValue={
                (kdo.autoskola[p.klic as keyof typeof kdo.autoskola] as string | null) ?? ""
              }
              disabled={!jeSpravce}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {"napoveda" in p && p.napoveda ? (
              <span className="mt-1 block text-xs text-neutral-500">{p.napoveda}</span>
            ) : null}
          </label>
        ))}

        {jeSpravce ? (
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-base font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Uložit
          </button>
        ) : (
          <p className="text-sm text-neutral-500">
            Údaje autoškoly smí měnit jen správce.
          </p>
        )}
      </form>
    </main>
  );
}
