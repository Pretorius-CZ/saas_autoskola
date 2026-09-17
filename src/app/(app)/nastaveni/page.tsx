import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { proAutoskolu } from "@/lib/db-tenant";
import { cisleniRady, tenants } from "@/db/schema";
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

  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");

  const [rada] = await db
    .select()
    .from(cisleniRady)
    .where(eq(cisleniRady.tenantId, kdo.autoskola.id))
    .limit(1);

  const posledni = rada?.posledniEvidencniCislo ?? 0;

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

    // --- logo ---------------------------------------------------------
    // Malý obrázek ukládáme rovnou do databáze. Povolujeme jen rastrové
    // formáty: SVG umí obsahovat skripty a logo je soubor od uživatele.
    const POVOLENE = ["image/png", "image/jpeg", "image/webp"];
    const MAX = 200 * 1024;

    let logo: { typ: string; data: string } | null | undefined;

    if (formData.get("logoSmazat") === "ano") {
      logo = null;
    } else {
      const soubor = formData.get("logo");
      if (soubor instanceof File && soubor.size > 0) {
        if (!POVOLENE.includes(soubor.type)) {
          throw new Error("Logo musí být PNG, JPEG nebo WEBP.");
        }
        if (soubor.size > MAX) {
          throw new Error(
            `Logo je moc velké (${Math.round(soubor.size / 1024)} kB). Nejvýš 200 kB.`,
          );
        }
        const bajty = Buffer.from(await soubor.arrayBuffer());
        logo = { typ: soubor.type, data: bajty.toString("base64") };
      }
    }

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
        motiv: hodnota("motiv") ?? "auto",
        barva: hodnota("barva") ?? "seda",
        // undefined = nech být, null = smaž, objekt = nahraď
        ...(logo === undefined
          ? {}
          : logo === null
            ? { logoTyp: null, logoData: null }
            : { logoTyp: logo.typ, logoData: logo.data }),
        updatedAt: new Date(),
      })
      // Nikdy ne "update tenants set ..." bez podmínky. Tahle řádka je důvod,
      // proč jeden překlep v budoucnu nepřepíše všechny autoškoly naráz.
      .where(eq(tenants.id, kdoTed.autoskola.id));

    // Číselná řada: autoškola si ji vede sama, my jen navazujeme.
    const zadane = hodnota("posledniEvidencniCislo");
    if (zadane !== null) {
      const cislo = Number(zadane.replace(/\s/g, ""));
      if (!Number.isInteger(cislo) || cislo < 0) {
        throw new Error("Poslední evidenční číslo musí být celé číslo od nuly výš.");
      }

      await proAutoskolu(kdoTed, (tx) =>
        tx.execute(sql`
          insert into cisleni_rady (tenant_id, posledni_evidencni_cislo)
          values (${kdoTed.autoskola.id}, ${cislo})
          on conflict (tenant_id) do update
            set posledni_evidencni_cislo = ${cislo}
        `),
      );
    }

    revalidatePath("/", "layout");
  }

  const jeSpravce = kdo.role === "spravce";
  const vstup =
    "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <main>
      <h1 className="text-lg font-semibold">Nastavení autoškoly</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tyhle údaje se propisují do hlášení pro úřad. Vyplň je přesně tak, jak
        jsou v registraci.
      </p>

      <form action={ulozit} encType="multipart/form-data" className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
          <div className="col-span-full flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Autoškola
            </span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          {pole.map((p) => (
            <label key={p.klic} className="block sm:col-span-2">
              <span className="text-xs text-neutral-500">{p.popis}</span>
              <input
                name={p.klic}
                defaultValue={
                  (kdo.autoskola[p.klic as keyof typeof kdo.autoskola] as string | null) ?? ""
                }
                disabled={!jeSpravce}
                className={vstup}
              />
              {"napoveda" in p && p.napoveda ? (
                <span className="mt-0.5 block text-xs text-neutral-500">{p.napoveda}</span>
              ) : null}
            </label>
          ))}

          <div className="col-span-full mt-2 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Evidenční kniha
            </span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <label className="block sm:col-span-2">
            <span className="text-xs text-neutral-500">Poslední přidělené číslo</span>
            <input
              name="posledniEvidencniCislo"
              inputMode="numeric"
              defaultValue={String(posledni)}
              disabled={!jeSpravce}
              className={vstup}
            />
            <span className="mt-0.5 block text-xs text-neutral-500">
              Nejvyšší číslo z tvé dosavadní knihy.
            </span>
          </label>

          <p className="col-span-full text-xs text-neutral-500 sm:col-span-4 sm:self-center">
            Další přijatý žák dostane číslo{" "}
            <span className="font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
              {posledni + 1}
            </span>
            . Řadu si vede autoškola — systém na ni jen navazuje. U jednotlivého
            žáka jde číslo přepsat v jeho úpravě.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
          <div className="col-span-full flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Vzhled
            </span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <label className="block sm:col-span-2">
            <span className="text-xs text-neutral-500">Motiv</span>
            <select
              name="motiv"
              defaultValue={kdo.autoskola.motiv}
              disabled={!jeSpravce}
              className={vstup}
            >
              <option value="auto">podle systému</option>
              <option value="svetly">světlý</option>
              <option value="tmavy">tmavý</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs text-neutral-500">Barva</span>
            <select
              name="barva"
              defaultValue={kdo.autoskola.barva}
              disabled={!jeSpravce}
              className={vstup}
            >
              <option value="seda">šedá</option>
              <option value="modra">modrá</option>
              <option value="zelena">zelená</option>
              <option value="vinova">vínová</option>
            </select>
          </label>

          <div className="sm:col-span-2">
            <p className="text-xs text-neutral-500">Ukázka</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="tlacitko">Tlačítko</span>
              <span className="tlacitko-vedlejsi">Vedlejší</span>
            </div>
          </div>

          <div className="col-span-full mt-2 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Logo
            </span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>

          {kdo.autoskola.logoData ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-neutral-500">Současné logo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${kdo.autoskola.logoTyp};base64,${kdo.autoskola.logoData}`}
                alt="Logo autoškoly"
                className="mt-1 max-h-12 w-auto"
              />
              <label className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                <input type="checkbox" name="logoSmazat" value="ano" disabled={!jeSpravce} />
                Smazat logo
              </label>
            </div>
          ) : null}

          <label className="block sm:col-span-4">
            <span className="text-xs text-neutral-500">
              {kdo.autoskola.logoData ? "Nahradit jiným" : "Nahrát logo"}
            </span>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              disabled={!jeSpravce}
              className="mt-0.5 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-200 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800"
            />
            <span className="mt-0.5 block text-xs text-neutral-500">
              PNG, JPEG nebo WEBP, nejvýš 200 kB. Zobrazí se v hlavičce.
            </span>
          </label>
        </div>

        {jeSpravce ? (
          <button
            type="submit"
            className="tlacitko"
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
