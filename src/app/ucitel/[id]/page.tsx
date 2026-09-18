import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import {
  kurzy,
  podpisy,
  terminy,
  ucitele,
  vozidla,
  vycviky,
  zaci,
} from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { cas, nazevDne, rozsah } from "@/lib/cas";
import { PREDMETY } from "@/lib/osnova";
import PodpisNahled from "@/components/podpis-nahled";
import PodpisJizdy from "./podpis-jizdy";
import KrokJizdy from "./jizda";

/**
 * Termín očima učitele.
 *
 * U jízdy se tu jede v pořadí: žák se podepíše, zahájí se se stavem
 * tachometru, na konci se ukončí zase se stavem tachometru. Vždycky je
 * vidět jen ten krok, který je na řadě — na telefonu v autě není čas
 * hledat mezi tlačítky.
 *
 * Termín se hledá spolu s identifikátorem přihlášeného učitele. Cizí
 * jízdu odsud neotevře ani ten, kdo uhodne adresu.
 */
export const dynamic = "force-dynamic";

function kroky(hotovo: boolean, popis: string) {
  return { hotovo, popis };
}

export default async function TerminUcitele({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [ucitel] = await tx
      .select({ id: ucitele.id })
      .from(ucitele)
      .where(
        and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.userId, kdo.uzivatelId)),
      )
      .limit(1);

    if (!ucitel) return null;

    const [zaznam] = await tx
      .select({
        t: terminy,
        kurz: kurzy,
        vozidlo: vozidla,
        vycvikId: vycviky.id,
        evidencniCislo: vycviky.evidencniCislo,
        jmeno: zaci.jmeno,
        prijmeni: zaci.prijmeni,
      })
      .from(terminy)
      .leftJoin(kurzy, eq(kurzy.id, terminy.kurzId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .leftJoin(vycviky, eq(vycviky.id, terminy.vycvikId))
      .leftJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(
        and(
          eq(terminy.id, id),
          eq(terminy.tenantId, kdo.autoskola.id),
          eq(terminy.ucitelId, ucitel.id),
        ),
      )
      .limit(1);

    if (!zaznam) return null;

    const [podpis] = await tx
      .select()
      .from(podpisy)
      .where(and(eq(podpisy.tenantId, kdo.autoskola.id), eq(podpisy.terminId, id)))
      .limit(1);

    // Poslední známý stav tachometru u vozidla — jen na předvyplnění.
    let posledniKm: number | null = null;
    if (zaznam.t.vozidloId && !zaznam.t.zahajenoKdy) {
      const [p] = await tx
        .select({ km: terminy.kmKonec })
        .from(terminy)
        .where(
          and(
            eq(terminy.tenantId, kdo.autoskola.id),
            eq(terminy.vozidloId, zaznam.t.vozidloId),
            isNotNull(terminy.kmKonec),
          ),
        )
        .orderBy(desc(terminy.ukoncenoKdy))
        .limit(1);
      posledniKm = p?.km ?? null;
    }

    return { zaznam, podpis: podpis ?? null, posledniKm };
  });

  if (!data) notFound();

  const { zaznam, podpis, posledniKm } = data;
  const { t } = zaznam;

  const predmet = (PREDMETY[zaznam.kurz?.skupina ?? "B"] ?? []).find(
    (p) => p.klic === t.predmet,
  );

  const jeJizda = t.druh === "jizda";
  const nadpis = jeJizda
    ? "Jízda"
    : predmet
      ? `Konzultace: ${predmet.nazev}`
      : "Konzultace";

  const postup = [
    kroky(Boolean(podpis), "Podpis žáka"),
    kroky(Boolean(t.zahajenoKdy), "Zahájení"),
    kroky(Boolean(t.ukoncenoKdy), "Ukončení"),
  ];

  const ujeto =
    t.kmZacatek !== null && t.kmKonec !== null ? t.kmKonec - t.kmZacatek : null;

  return (
    <main>
      <Link
        href="/ucitel"
        className="text-xs text-neutral-500 underline-offset-4 hover:underline"
      >
        ← Moje termíny
      </Link>

      <h1 className="mt-1 text-lg font-semibold">{nadpis}</h1>

      <p className="text-sm text-neutral-500">
        {nazevDne(t.zacatek)} {t.zacatek.toLocaleDateString("cs-CZ")} ·{" "}
        {rozsah(t.zacatek, t.delkaMinut)}
        {t.stav === "zruseno" ? " · zrušeno" : ""}
      </p>

      <p className="mt-1 text-sm text-neutral-500">
        {[
          zaznam.jmeno
            ? `${zaznam.evidencniCislo} ${zaznam.jmeno} ${zaznam.prijmeni}`
            : zaznam.kurz?.nazev,
          zaznam.vozidlo ? `${zaznam.vozidlo.znacka} ${zaznam.vozidlo.rz}` : null,
          t.misto,
          t.tema,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {!jeJizda ? (
        <p className="mt-6 text-sm text-neutral-500">
          U konzultací se nepodepisuje ani nezapisuje tachometr. Docházku
          zapisuje autoškola v kalendáři.
        </p>
      ) : (
        <>
          <ol className="mt-5 flex gap-2 text-xs">
            {postup.map((k) => (
              <li
                key={k.popis}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${
                  k.hotovo
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
                }`}
              >
                {k.popis}
              </li>
            ))}
          </ol>

          <section className="mt-5">
            {t.stav === "zruseno" ? (
              <p className="text-sm text-neutral-500">
                Zrušená jízda se nezapisuje.
              </p>
            ) : !zaznam.vycvikId ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                U téhle jízdy není zapsaný žák, takže není kdo by se podepsal.
                Řekni o tom správci.
              </p>
            ) : !podpis ? (
              <PodpisJizdy terminId={t.id} jmeno={zaznam.jmeno ?? "prosím"} />
            ) : !t.zahajenoKdy ? (
              <KrokJizdy terminId={t.id} krok="zahajit" nabidka={posledniKm} />
            ) : !t.ukoncenoKdy ? (
              <>
                <p className="text-sm">
                  Jízda běží od {cas(t.zahajenoKdy)}, vyjelo se při{" "}
                  <span className="tabular-nums">{t.kmZacatek}</span> km.
                </p>
                <div className="mt-3">
                  <KrokJizdy terminId={t.id} krok="ukoncit" nabidka={null} />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <p className="text-sm font-medium">Jízda je hotová.</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {cas(t.zahajenoKdy)} – {cas(t.ukoncenoKdy)} ·{" "}
                  <span className="tabular-nums">{t.kmZacatek}</span> →{" "}
                  <span className="tabular-nums">{t.kmKonec}</span> km
                  {ujeto !== null ? (
                    <>
                      {" "}
                      · ujeto <span className="tabular-nums">{ujeto}</span> km
                    </>
                  ) : null}
                </p>
              </div>
            )}
          </section>

          {podpis ? (
            <section className="mt-5">
              <p className="text-xs text-neutral-500">
                Podepsáno {podpis.podepsanoKdy.toLocaleString("cs-CZ")}
              </p>
              <div className="mt-1 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800">
                <PodpisNahled kresba={podpis.kresba} vyska={80} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Podpis už přepsat nejde. Kdyby se podepsal někdo omylem, řekni
                to správci — opraví se to v evidenci a zůstane o tom záznam.
              </p>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
