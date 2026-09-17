import Link from "next/link";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucitele, vozidla, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { denAMesic, nazevDne, pondeli, pridejDny, proAdresu, rozsah, tyden, zAdresy } from "@/lib/cas";
import NovyTermin from "./novy-termin";
import ZrusitTermin from "./zrusit-termin";

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

export default async function Kalendar({
  searchParams,
}: {
  searchParams: Promise<{ tyden?: string }>;
}) {
  const kdo = await vyzadujPrihlaseni();
  const { tyden: zadany } = await searchParams;

  const od = pondeli(zAdresy(zadany));
  const do_ = pridejDny(od, 7);
  const dny = tyden(od);

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

  const dnesek = proAdresu(new Date());

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Kalendář{" "}
          <span className="font-normal text-neutral-500">
            {denAMesic(od)} – {denAMesic(pridejDny(od, 6))} {od.getFullYear()}
          </span>
        </h1>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/kalendar?tyden=${proAdresu(pridejDny(od, -7))}`}
            className="tlacitko-vedlejsi"
          >
            ←
          </Link>
          <Link href="/kalendar" className="tlacitko-vedlejsi">
            Dnes
          </Link>
          <Link
            href={`/kalendar?tyden=${proAdresu(pridejDny(od, 7))}`}
            className="tlacitko-vedlejsi"
          >
            →
          </Link>
        </div>
      </div>

      <NovyTermin
        ucitele={data.seznamUcitelu}
        vozidla={data.seznamVozidel}
        kurzy={data.seznamKurzu}
        zaci={data.seznamZaku}
        vychoziDatum={proAdresu(od)}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dny.map((den) => {
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
                <span className={`text-sm ${jeDnes ? "font-semibold" : "font-medium"}`}>
                  {nazevDne(den)}
                </span>
                <span className="text-xs text-neutral-500">{denAMesic(den)}</span>
              </h2>

              {vDen.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-400">volno</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {vDen.map((z) => (
                    <li
                      key={z.t.id}
                      className={`border-l-4 pl-2 ${
                        z.t.stav === "zruseno"
                          ? "border-l-neutral-300 opacity-50 dark:border-l-neutral-700"
                          : (barvaUcitele.get(z.t.ucitelId ?? "") ?? "border-l-neutral-400")
                      }`}
                    >
                      <p className="text-sm">
                        <span className="tabular-nums">
                          {rozsah(z.t.zacatek, z.t.delkaMinut)}
                        </span>
                        {z.t.stav === "zruseno" ? (
                          <span className="ml-1 text-xs text-neutral-500">zrušeno</span>
                        ) : null}
                      </p>

                      <p className="text-sm">
                        {z.t.druh === "teorie" ? (
                          <>
                            <span className="text-neutral-500">teorie · </span>
                            {z.kurz?.nazev ?? "—"}
                          </>
                        ) : (
                          <>
                            {z.zak ? (
                              <Link
                                href={`/zaci/${z.t.vycvikId}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {z.zak.jmeno} {z.zak.prijmeni}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </>
                        )}
                      </p>

                      <p className="text-xs text-neutral-500">
                        {[
                          z.ucitel ? `${z.ucitel.jmeno} ${z.ucitel.prijmeni}` : null,
                          z.vozidlo ? z.vozidlo.rz : null,
                          z.t.tema,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      {z.t.stav !== "zruseno" ? <ZrusitTermin id={z.t.id} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
