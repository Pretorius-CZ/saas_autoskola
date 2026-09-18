import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import {
  kurzy,
  poznamkyKurzu,
  terminy,
  ucast,
  ucitele,
  vycviky,
  zaci,
} from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { nazevDne, rozsah as casovyRozsah } from "@/lib/cas";
import { PREDMETY, konzultaciZaPredmet, naHodiny } from "@/lib/osnova";
import Obdobi, { okamziky, rozsahZAdresy } from "../../obdobi";
import Tisk from "../../tisk";
import Poznamka from "./poznamka";

/**
 * Třídní kniha jednoho kurzu.
 *
 * Má dvě části, jako ta papírová: nahoře seznam zařazených žáků, pod ním
 * záznam o výuce s docházkou. U každého žáka je vidět, kolik hodin má
 * odbytých — a to jen z těch termínů, na kterých byl označený jako
 * přítomný.
 *
 * V seznamu je každý, kdo je do kurzu zařazený — i ten, kdo zatím nebyl
 * na ničem. Kdo donese žádost a zaplatí, do knihy patří; že mu do toho
 * přišla nemoc, je jeho záznam, ne důvod ho vynechat. Proto se seznam
 * bere ze zařazení do kurzu, ne z docházky.
 *
 * Adresa "bez-kurzu" ukazuje výuku, která žádný kurz přiřazený nemá.
 * Není to třídní kniha, je to seznam toho, co je potřeba opravit.
 */
export const dynamic = "force-dynamic";

export default async function TridniKnihaKurzu({
  params,
  searchParams,
}: {
  params: Promise<{ kurz: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kurz: kurzParam } = await params;
  const p = await searchParams;
  const kdo = await vyzadujPrihlaseni();

  const r = rozsahZAdresy(p);
  const { zacatek, konec } = okamziky(r);
  const bezKurzu = kurzParam === "bez-kurzu";

  const data = await proAutoskolu(kdo, async (tx) => {
    const kurz = bezKurzu
      ? null
      : (
          await tx
            .select()
            .from(kurzy)
            .where(and(eq(kurzy.id, kurzParam), eq(kurzy.tenantId, kdo.autoskola.id)))
            .limit(1)
        )[0];

    if (!bezKurzu && !kurz) return null;

    const clenove = bezKurzu
      ? []
      : await tx
          .select({
            vycvikId: vycviky.id,
            evidencniCislo: vycviky.evidencniCislo,
            skupina: vycviky.skupina,
            jmeno: zaci.jmeno,
            prijmeni: zaci.prijmeni,
            titul: zaci.titul,
            datumNarozeni: zaci.datumNarozeni,
            ulice: zaci.ulice,
            mesto: zaci.mesto,
            psc: zaci.psc,
          })
          .from(vycviky)
          .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
          .where(
            and(
              eq(vycviky.tenantId, kdo.autoskola.id),
              eq(vycviky.kurzId, kurzParam),
            ),
          )
          .orderBy(asc(zaci.prijmeni), asc(zaci.jmeno));

    const seznam = await tx
      .select({ t: terminy, ucitel: ucitele })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          ne(terminy.druh, "jizda"),
          ne(terminy.stav, "zruseno"),
          gte(terminy.zacatek, zacatek),
          lte(terminy.zacatek, konec),
          bezKurzu ? isNull(terminy.kurzId) : eq(terminy.kurzId, kurzParam),
        ),
      )
      .orderBy(asc(terminy.zacatek));

    const idcka = seznam.map((x) => x.t.id);

    const ucastnici =
      idcka.length === 0
        ? []
        : await tx
            .select({
              terminId: ucast.terminId,
              vycvikId: ucast.vycvikId,
              pritomen: ucast.pritomen,
            })
            .from(ucast)
            .where(
              and(eq(ucast.tenantId, kdo.autoskola.id), inArray(ucast.terminId, idcka)),
            );

    // Poznámky k žákům v tomhle kurzu — proč u někoho hodiny nejsou.
    const poznamky = bezKurzu
      ? []
      : await tx
          .select({
            vycvikId: poznamkyKurzu.vycvikId,
            poznamka: poznamkyKurzu.poznamka,
          })
          .from(poznamkyKurzu)
          .where(
            and(
              eq(poznamkyKurzu.tenantId, kdo.autoskola.id),
              eq(poznamkyKurzu.kurzId, kurzParam),
            ),
          );

    return { kurz, clenove, seznam, ucastnici, poznamky };
  });

  if (!data) notFound();

  const { kurz, clenove, seznam, ucastnici, poznamky } = data;

  const poznamkaZaka = new Map<string, string>();
  for (const p of poznamky) poznamkaZaka.set(p.vycvikId, p.poznamka);

  // Kdo byl na kterém termínu.
  const pritomniNaTerminu = new Map<string, Set<string>>();
  for (const u of ucastnici) {
    if (!u.pritomen) continue;
    const s = pritomniNaTerminu.get(u.terminId) ?? new Set<string>();
    s.add(u.vycvikId);
    pritomniNaTerminu.set(u.terminId, s);
  }

  // Kolik hodin má kdo odbytých — jen z termínů, na kterých byl.
  const hodinZaka = new Map<string, number>();
  for (const x of seznam) {
    if (x.t.stav !== "probehlo") continue;
    for (const vycvikId of pritomniNaTerminu.get(x.t.id) ?? []) {
      hodinZaka.set(
        vycvikId,
        (hodinZaka.get(vycvikId) ?? 0) + naHodiny(x.t.delkaMinut),
      );
    }
  }

  const hodinCelkem = seznam.reduce((s, x) => s + naHodiny(x.t.delkaMinut), 0);
  const predmety = PREDMETY[kurz?.skupina ?? "B"] ?? [];
  const cilHodin = predmety.reduce((s, x) => s + konzultaciZaPredmet(x.hodin), 0);

  function nazevPredmetu(klic: string | null) {
    if (!klic) return "—";
    return predmety.find((x) => x.klic === klic)?.nazev ?? klic;
  }

  const zpet = `/sestavy/tridni-kniha?od=${r.od}&do=${r.do}`;

  return (
    <main className="space-y-4">
      <div className="netisknout">
        <Link
          href={zpet}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Třídní knihy
        </Link>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold">
          {bezKurzu ? "Výuka mimo kurz" : `Třídní kniha — ${kurz!.nazev}`}{" "}
          <span className="font-normal text-neutral-500">{kdo.autoskola.nazev}</span>
        </h1>
        <p className="text-sm text-neutral-500">
          {formatDatum(r.od)} – {formatDatum(r.do)} · {seznam.length}{" "}
          {seznam.length === 1 ? "termín" : seznam.length < 5 ? "termíny" : "termínů"} ·{" "}
          {Math.round(hodinCelkem * 10) / 10} h
        </p>
      </div>

      {bezKurzu ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Tyhle termíny nemají přiřazený kurz, takže u nich nejde vést docházku
          a nepočítají se nikomu do plnění osnovy. Oprav jim kurz v kalendáři.
        </p>
      ) : (
        <>
          {kurz!.poznamka ? (
            <p className="text-sm text-neutral-500">{kurz!.poznamka}</p>
          ) : null}

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Žáci kurzu ({clenove.length})
            </h2>

            {clenove.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">
                Do kurzu zatím nikdo není zařazený.
              </p>
            ) : (
              /* Kdo je zařazený, je v seznamu — i s nulou odbytých hodin. */
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Č.</th>
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                      Jméno a příjmení
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                      Narozen
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                      Bydliště
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Sk.</th>
                    <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                      Odbyto v období
                    </th>
                    <th className="py-2 text-xs font-medium text-neutral-500">
                      Poznámka
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clenove.map((c) => (
                    <tr
                      key={c.vycvikId}
                      className="border-b border-neutral-100 align-top dark:border-neutral-900"
                    >
                      <td className="py-1.5 pr-3 tabular-nums">{c.evidencniCislo}</td>
                      <td className="py-1.5 pr-3">
                        {c.titul ? `${c.titul} ` : ""}
                        {c.jmeno} {c.prijmeni}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                        {formatDatum(c.datumNarozeni)}
                      </td>
                      <td className="py-1.5 pr-3">
                        {[c.ulice, [c.psc, c.mesto].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="py-1.5 pr-3">{c.skupina}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                        {Math.round((hodinZaka.get(c.vycvikId) ?? 0) * 10) / 10} h
                        {cilHodin > 0 ? (
                          <span className="text-neutral-500"> z {cilHodin} h celkem</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-sm">
                        <Poznamka
                          kurzId={kurzParam}
                          vycvikId={c.vycvikId}
                          puvodni={poznamkaZaka.get(c.vycvikId) ?? ""}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <Obdobi cesta={`/sestavy/tridni-kniha/${kurzParam}`} rozsah={r} />

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Záznam o výuce
        </h2>

        {seznam.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">
            Ve vybraném období není zapsaná žádná výuka.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Datum</th>
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Čas</th>
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Hod.</th>
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                    Předmět
                  </th>
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Téma</th>
                  <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Učitel</th>
                  <th className="py-2 text-xs font-medium text-neutral-500">Účast</th>
                </tr>
              </thead>
              <tbody>
                {seznam.map((x) => {
                  const byli = pritomniNaTerminu.get(x.t.id) ?? new Set<string>();
                  const zapsana = x.t.stav === "probehlo";

                  return (
                    <tr
                      key={x.t.id}
                      className="border-b border-neutral-100 align-top dark:border-neutral-900"
                    >
                      <td className="whitespace-nowrap py-1.5 pr-3">
                        <span className="text-neutral-500">
                          {nazevDne(x.t.zacatek)}{" "}
                        </span>
                        <span className="tabular-nums">
                          {x.t.zacatek.toLocaleDateString("cs-CZ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                        {casovyRozsah(x.t.zacatek, x.t.delkaMinut)}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">
                        {naHodiny(x.t.delkaMinut)}
                      </td>
                      <td className="py-1.5 pr-3">{nazevPredmetu(x.t.predmet)}</td>
                      <td className="py-1.5 pr-3">{x.t.tema ?? "—"}</td>
                      <td className="whitespace-nowrap py-1.5 pr-3">
                        {x.ucitel ? `${x.ucitel.jmeno} ${x.ucitel.prijmeni}` : "—"}
                      </td>
                      <td className="py-1.5">
                        {!zapsana ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            docházka nezapsaná
                          </span>
                        ) : clenove.length === 0 ? (
                          <span className="text-neutral-500">—</span>
                        ) : (
                          <>
                            {clenove
                              .filter((c) => byli.has(c.vycvikId))
                              .map((c) => `${c.evidencniCislo} ${c.prijmeni}`)
                              .join(", ") || "nikdo nebyl"}
                            {clenove.some((c) => !byli.has(c.vycvikId)) ? (
                              <span className="block text-xs text-neutral-500">
                                nebyli:{" "}
                                {clenove
                                  .filter((c) => !byli.has(c.vycvikId))
                                  .map((c) => `${c.evidencniCislo} ${c.prijmeni}`)
                                  .join(", ")}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <Tisk />
        <p className="netisknout text-xs text-neutral-500">
          Tiskne se seznam žáků i záznam o výuce, bez menu a filtrů.
        </p>
      </div>
    </main>
  );
}
