import Link from "next/link";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucitele, vozidla, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import {
  denAMesic,
  mrizkaMesice,
  nazevDne,
  nazevMesice,
  pondeli,
  posunMesic,
  pridejDny,
  proAdresu,
  prvniVMesici,
  stejnyMesic,
  tyden,
  zAdresy,
} from "@/lib/cas";
import NovyTermin from "./novy-termin";
import PolozkaTerminu, { type Polozka } from "./polozka";
import Prepinac, { POHLEDY, type Pohled } from "./prepinac";

export const dynamic = "force-dynamic";

/** Barevné odlišení podle učitele — v týdnu se pak dá číst očima. */
const BARVY = [
  "border-l-sky-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
  "border-l-teal-500",
];

/** Tečky v měsíci. Musí být vypsané celé, Tailwind je hledá v textu. */
const TECKY = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
];

function jePohled(v: unknown): v is Pohled {
  return POHLEDY.some((p) => p.klic === v);
}

export default async function Kalendar({
  searchParams,
}: {
  searchParams: Promise<{
    pohled?: string;
    datum?: string;
    /** Starší odkazy a záložky používaly ?tyden= — ať nepřestanou fungovat. */
    tyden?: string;
    nove?: string;
  }>;
}) {
  const kdo = await vyzadujPrihlaseni();
  const q = await searchParams;

  const pohled: Pohled = jePohled(q.pohled) ? q.pohled : "tyden";
  const datum = zAdresy(q.datum ?? q.tyden);

  // Které období se načítá a jak daleko skáčou šipky.
  const od =
    pohled === "den"
      ? new Date(datum.getFullYear(), datum.getMonth(), datum.getDate())
      : pohled === "tyden"
        ? pondeli(datum)
        : mrizkaMesice(datum)[0];

  const dnu = pohled === "den" ? 1 : pohled === "tyden" ? 7 : 42;
  const do_ = pridejDny(od, dnu);

  const predchozi =
    pohled === "den"
      ? pridejDny(datum, -1)
      : pohled === "tyden"
        ? pridejDny(datum, -7)
        : posunMesic(datum, -1);

  const dalsi =
    pohled === "den"
      ? pridejDny(datum, 1)
      : pohled === "tyden"
        ? pridejDny(datum, 7)
        : posunMesic(datum, 1);

  const data = await proAutoskolu(kdo, async (tx) => {
    const zaznamy = await tx
      .select({
        t: terminy,
        ucitel: ucitele,
        vozidlo: vozidla,
        kurz: kurzy,
        zak: zaci,
      })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .leftJoin(kurzy, eq(kurzy.id, terminy.kurzId))
      .leftJoin(vycviky, eq(vycviky.id, terminy.vycvikId))
      .leftJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          gte(terminy.zacatek, od),
          lt(terminy.zacatek, do_),
        ),
      )
      .orderBy(asc(terminy.zacatek));

    const seznamUcitelu = await tx
      .select({ id: ucitele.id, jmeno: ucitele.jmeno, prijmeni: ucitele.prijmeni })
      .from(ucitele)
      .where(and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.aktivni, true)))
      .orderBy(asc(ucitele.prijmeni));

    const seznamVozidel = await tx
      .select({ id: vozidla.id, znacka: vozidla.znacka, typ: vozidla.typ, rz: vozidla.rz })
      .from(vozidla)
      .where(and(eq(vozidla.tenantId, kdo.autoskola.id), eq(vozidla.aktivni, true)))
      .orderBy(asc(vozidla.znacka));

    const seznamKurzu = await tx
      .select({ id: kurzy.id, nazev: kurzy.nazev, skupina: kurzy.skupina })
      .from(kurzy)
      .where(and(eq(kurzy.tenantId, kdo.autoskola.id), eq(kurzy.aktivni, true)))
      .orderBy(asc(kurzy.nazev));

    const seznamZaku = await tx
      .select({
        id: vycviky.id,
        evidencniCislo: vycviky.evidencniCislo,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
        skupina: vycviky.skupina,
      })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.tenantId, kdo.autoskola.id), ne(vycviky.stav, "zruseno")))
      .orderBy(asc(zaci.prijmeni));

    return { zaznamy, seznamUcitelu, seznamVozidel, seznamKurzu, seznamZaku };
  });

  const barvaUcitele = new Map(
    data.seznamUcitelu.map((u, i) => [u.id, BARVY[i % BARVY.length]]),
  );
  const teckaUcitele = new Map(
    data.seznamUcitelu.map((u, i) => [u.id, TECKY[i % TECKY.length]]),
  );

  /** Ze záznamu z databáze udělá to, co umí vypsat společná položka. */
  function naPolozku(z: (typeof data.zaznamy)[number]): Polozka {
    return {
      id: z.t.id,
      zacatek: z.t.zacatek,
      delkaMinut: z.t.delkaMinut,
      druh: z.t.druh,
      stav: z.t.stav,
      tema: z.t.tema,
      misto: z.t.misto,
      poznamka: z.t.poznamka,
      vycvikId: z.t.vycvikId,
      ucitel: z.ucitel ? `${z.ucitel.jmeno} ${z.ucitel.prijmeni}` : null,
      vozidlo: z.vozidlo ? z.vozidlo.rz : null,
      kurz: z.kurz?.nazev ?? null,
      zak: z.zak ? `${z.zak.jmeno} ${z.zak.prijmeni}` : null,
      barva: barvaUcitele.get(z.t.ucitelId ?? "") ?? "border-l-neutral-400",
    };
  }

  const dnesek = proAdresu(new Date());
  const datumText = proAdresu(datum);

  const nadpis =
    pohled === "den"
      ? `${nazevDne(datum)} ${denAMesic(datum)} ${datum.getFullYear()}`
      : pohled === "tyden"
        ? `${denAMesic(od)} – ${denAMesic(pridejDny(od, 6))} ${od.getFullYear()}`
        : `${nazevMesice(datum)} ${datum.getFullYear()}`;

  const adresa = (d: Date) => `/kalendar?pohled=${pohled}&datum=${proAdresu(d)}`;

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Kalendář <span className="font-normal text-neutral-500">{nadpis}</span>
        </h1>

        {/* Přepínač a šipky jsou dvě skupiny. Zalomit se smí mezi nimi,
            nikdy uvnitř — jinak šipka "další" skončí sama na dalším
            řádku a vypadá to jako chyba. */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Prepinac pohled={pohled} datum={datumText} />

          <div className="flex shrink-0 flex-nowrap items-center gap-1">
            <Link
              href={adresa(predchozi)}
              className="tlacitko-vedlejsi px-3"
              aria-label="Předchozí"
            >
              ←
            </Link>
            <Link href={`/kalendar?pohled=${pohled}`} className="tlacitko-vedlejsi px-3">
              Dnes
            </Link>
            <Link
              href={adresa(dalsi)}
              className="tlacitko-vedlejsi px-3"
              aria-label="Další"
            >
              →
            </Link>
          </div>
        </div>
      </div>

      {pohled !== "mesic" ? (
        <NovyTermin
          ucitele={data.seznamUcitelu}
          vozidla={data.seznamVozidel}
          kurzy={data.seznamKurzu}
          zaci={data.seznamZaku}
          vychoziDatum={q.nove ?? proAdresu(pohled === "den" ? datum : od)}
          otevreno={Boolean(q.nove)}
          odkazOtevrit={`${adresa(datum)}&nove=${proAdresu(
            pohled === "den" ? datum : od,
          )}`}
          odkazZavrit={adresa(datum)}
        />
      ) : null}

      {pohled === "den" ? (
        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          {data.zaznamy.length === 0 ? (
            <p className="text-sm text-neutral-400">Tenhle den je volno.</p>
          ) : (
            <ul className="space-y-3">
              {data.zaznamy.map((z) => (
                <PolozkaTerminu key={z.t.id} t={naPolozku(z)} velka />
              ))}
            </ul>
          )}

          <Link
            href={`${adresa(datum)}&nove=${datumText}`}
            className="mt-4 block rounded-md border border-dashed border-neutral-300 py-2 text-center text-sm text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
          >
            + naplánovat na tenhle den
          </Link>
        </section>
      ) : null}

      {pohled === "tyden" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tyden(od).map((den) => {
            const denText = proAdresu(den);
            const vDen = data.zaznamy.filter((z) => proAdresu(z.t.zacatek) === denText);
            const jeDnes = denText === dnesek;

            return (
              <section
                key={denText}
                className={`rounded-xl border p-3 ${
                  jeDnes
                    ? "border-neutral-400 dark:border-neutral-500"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <h2 className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/kalendar?pohled=den&datum=${denText}`}
                    className={`text-sm underline-offset-4 hover:underline ${
                      jeDnes ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {nazevDne(den)}
                  </Link>
                  <span className="text-xs text-neutral-500">{denAMesic(den)}</span>
                </h2>

                {vDen.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-400">volno</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {vDen.map((z) => (
                      <PolozkaTerminu key={z.t.id} t={naPolozku(z)} />
                    ))}
                  </ul>
                )}

                <Link
                  href={`${adresa(od)}&nove=${denText}`}
                  className="mt-2 block rounded-md border border-dashed border-neutral-300 py-1 text-center text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
                >
                  + naplánovat
                </Link>
              </section>
            );
          })}
        </div>
      ) : null}

      {pohled === "mesic" ? (
        <>
          {/* Měsíc je mapa vytížení, ne výpis termínů. Detaily se do něj
              nevejdou v žádné velikosti písma — čísla a tečky ano.
              Klepnutí na den přepne na denní pohled, kde je všechno. */}
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-800">
            {["po", "út", "st", "čt", "pá", "so", "ne"].map((d) => (
              <div
                key={d}
                className="bg-neutral-50 py-1 text-center text-xs font-medium text-neutral-500 dark:bg-neutral-950"
              >
                {d}
              </div>
            ))}

            {mrizkaMesice(datum).map((den) => {
              const denText = proAdresu(den);
              const vDen = data.zaznamy.filter(
                (z) => proAdresu(z.t.zacatek) === denText && z.t.stav !== "zruseno",
              );
              const jizd = vDen.filter((z) => z.t.druh === "jizda").length;
              const teorii = vDen.length - jizd;
              const jeDnes = denText === dnesek;
              const vMesici = stejnyMesic(den, prvniVMesici(datum));

              return (
                <Link
                  key={denText}
                  href={`/kalendar?pohled=den&datum=${denText}`}
                  className={`min-h-20 bg-white p-1.5 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-900 ${
                    vMesici ? "" : "opacity-40"
                  }`}
                >
                  <span
                    className={`block text-xs tabular-nums ${
                      jeDnes
                        ? "font-bold text-emerald-600 dark:text-emerald-400"
                        : "text-neutral-500"
                    }`}
                  >
                    {den.getDate()}
                  </span>

                  {vDen.length > 0 ? (
                    <>
                      <span className="mt-0.5 block text-xs">
                        {jizd > 0 ? `${jizd}× jízda` : null}
                        {jizd > 0 && teorii > 0 ? <br /> : null}
                        {teorii > 0 ? `${teorii}× teorie` : null}
                      </span>

                      <span className="mt-1 flex flex-wrap gap-0.5">
                        {vDen.map((z) => (
                          <span
                            key={z.t.id}
                            className={`size-1.5 rounded-full ${
                              teckaUcitele.get(z.t.ucitelId ?? "") ?? "bg-neutral-400"
                            }`}
                          />
                        ))}
                      </span>
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {data.seznamUcitelu.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              {data.seznamUcitelu.map((u) => (
                <span key={u.id} className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full ${teckaUcitele.get(u.id)}`}
                  />
                  {u.prijmeni}
                </span>
              ))}
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
