import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNotNull, ne, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import {
  kurzy,
  podpisy,
  terminy,
  ucast,
  ucitele,
  vozidla,
  vycviky,
  zaci,
} from "@/db/schema";
import { vyzadujSpravce } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";
import { nazevDne, rozsah } from "@/lib/cas";
import {
  HODIN_VYCVIKU,
  PREDMETY,
  konzultaciZaPredmet,
  naHodiny,
  osnovaPredepisuje,
} from "@/lib/osnova";
import PodpisNahled from "@/components/podpis-nahled";
import Tisk from "../../tisk";

/**
 * Sestava o výuce a výcviku jednoho žáka.
 *
 * V tabulkách je jen to, co je doložené: konzultace se zapsanou účastí
 * a jízdy ukončené se stavem tachometru. Co doložené není, se
 * nedopočítává — ale ani neschovává: pod tabulkou je napsané, kolik
 * takových termínů je. Tichý rozdíl mezi papírem a evidencí je to
 * poslední, co u kontroly potřebuješ.
 */
export const dynamic = "force-dynamic";

export default async function SestavaZaka({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujSpravce();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [zaznam] = await tx
      .select({ v: vycviky, z: zaci, u: ucitele, k: kurzy })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .leftJoin(ucitele, eq(ucitele.id, vycviky.ucitelId))
      .leftJoin(kurzy, eq(kurzy.id, vycviky.kurzId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!zaznam) return null;

    // Jeho jízdy a teorie jeho kurzu — pro něj je to jeden výcvik.
    const seznam = await tx
      .select({ t: terminy, ucitel: ucitele, vozidlo: vozidla })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      .leftJoin(vozidla, eq(vozidla.id, terminy.vozidloId))
      .where(
        and(
          eq(terminy.tenantId, kdo.autoskola.id),
          ne(terminy.stav, "zruseno"),
          zaznam.v.kurzId
            ? or(
                eq(terminy.vycvikId, zaznam.v.id),
                and(eq(terminy.druh, "teorie"), eq(terminy.kurzId, zaznam.v.kurzId)),
              )
            : eq(terminy.vycvikId, zaznam.v.id),
        ),
      )
      .orderBy(asc(terminy.zacatek));

    const ucastniky = await tx
      .select({ terminId: ucast.terminId, pritomen: ucast.pritomen })
      .from(ucast)
      .where(
        and(eq(ucast.tenantId, kdo.autoskola.id), eq(ucast.vycvikId, zaznam.v.id)),
      );

    const podpisySeznam = await tx
      .select({ terminId: podpisy.terminId, kresba: podpisy.kresba })
      .from(podpisy)
      .where(
        and(
          eq(podpisy.tenantId, kdo.autoskola.id),
          eq(podpisy.vycvikId, zaznam.v.id),
          isNotNull(podpisy.kresba),
        ),
      );

    return { zaznam, seznam, ucastniky, podpisySeznam };
  });

  if (!data) notFound();

  const { zaznam, seznam, ucastniky, podpisySeznam } = data;
  const { v, z, u, k } = zaznam;

  const pritomnost = new Map(ucastniky.map((x) => [x.terminId, x.pritomen]));
  const podpisTerminu = new Map(podpisySeznam.map((x) => [x.terminId, x.kresba]));

  const ted = Date.now();
  const minule = seznam.filter((x) => x.t.zacatek.getTime() < ted);

  // Doložená výuka: konzultace se zapsanou docházkou, na které žák byl.
  const vyuka = minule.filter(
    (x) => x.t.druh !== "jizda" && x.t.stav === "probehlo" && pritomnost.get(x.t.id),
  );
  const vyukaChybi = minule.filter(
    (x) => x.t.druh !== "jizda" && x.t.stav !== "probehlo",
  ).length;

  // Doložený výcvik: ukončená jízda se stavem tachometru.
  const vycvik = minule.filter((x) => x.t.druh === "jizda" && x.t.ukoncenoKdy);
  const vycvikChybi = minule.filter(
    (x) => x.t.druh === "jizda" && !x.t.ukoncenoKdy,
  ).length;

  const sOsnovou = osnovaPredepisuje(v.druh);
  const predmety = sOsnovou ? (PREDMETY[v.skupina] ?? []) : [];

  const hodinPredmetu = new Map<string, number>();
  for (const x of vyuka) {
    const klic = x.t.predmet ?? "?";
    hodinPredmetu.set(klic, (hodinPredmetu.get(klic) ?? 0) + naHodiny(x.t.delkaMinut));
  }

  const hodinJizd = vycvik.reduce((s, x) => s + naHodiny(x.t.delkaMinut), 0);
  const kmCelkem = vycvik.reduce(
    (s, x) =>
      x.t.kmZacatek !== null && x.t.kmKonec !== null
        ? s + (x.t.kmKonec - x.t.kmZacatek)
        : s,
    0,
  );
  const cilJizd = sOsnovou ? HODIN_VYCVIKU[v.skupina] : undefined;

  function nazevPredmetu(klic: string | null) {
    if (!klic) return "—";
    return predmety.find((x) => x.klic === klic)?.nazev ?? klic;
  }

  return (
    <main className="space-y-5">
      <div className="netisknout">
        <Link
          href={`/zaci/${v.id}`}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Zpět na kartu
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">
            Výuka a výcvik{" "}
            <span className="font-normal text-neutral-500">{kdo.autoskola.nazev}</span>
          </h1>
          <p className="text-sm text-neutral-500">
            evidenční číslo <span className="tabular-nums">{v.evidencniCislo}</span>
          </p>
        </div>

        <p className="mt-1 text-sm">
          <span className="font-medium">
            {z.titul ? `${z.titul} ` : ""}
            {z.jmeno} {z.prijmeni}
          </span>
          {" · nar. "}
          <span className="tabular-nums">{formatDatum(z.datumNarozeni)}</span>
          {z.mesto ? ` · ${[z.ulice, [z.psc, z.mesto].filter(Boolean).join(" ")].filter(Boolean).join(", ")}` : ""}
        </p>

        <p className="mt-0.5 text-sm text-neutral-500">
          skupina {v.skupina}
          {u ? ` · učitel ${u.jmeno} ${u.prijmeni}` : ""}
          {k ? ` · kurz ${k.nazev}` : ""}
          {v.datumZahajeni ? ` · zahájeno ${formatDatum(v.datumZahajeni)}` : ""}
          {v.datumUkonceni ? ` · ukončeno ${formatDatum(v.datumUkonceni)}` : ""}
        </p>
      </header>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Výuka — doložená účast
        </h2>

        {vyuka.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">Zatím nic doloženého.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Datum</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Čas</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Hod.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Předmět</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Téma</th>
                <th className="py-2 text-xs font-medium text-neutral-500">Učitel</th>
              </tr>
            </thead>
            <tbody>
              {vyuka.map((x) => (
                <tr
                  key={x.t.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className="text-neutral-500">{nazevDne(x.t.zacatek)} </span>
                    <span className="tabular-nums">
                      {x.t.zacatek.toLocaleDateString("cs-CZ")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {rozsah(x.t.zacatek, x.t.delkaMinut)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{naHodiny(x.t.delkaMinut)}</td>
                  <td className="py-1.5 pr-3">{nazevPredmetu(x.t.predmet)}</td>
                  <td className="py-1.5 pr-3">{x.t.tema ?? "—"}</td>
                  <td className="whitespace-nowrap py-1.5">
                    {x.ucitel ? `${x.ucitel.jmeno} ${x.ucitel.prijmeni}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {vyukaChybi > 0 ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            V sestavě není {vyukaChybi} proběhlých konzultací, u kterých není
            zapsaná docházka.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Výcvik — dokončené jízdy
        </h2>

        {vycvik.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">Zatím nic doloženého.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left dark:border-neutral-700">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Datum</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Čas</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Hod.</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Učitel</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Vozidlo</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">
                  Tachometr
                </th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Ujeto</th>
                <th className="py-2 text-xs font-medium text-neutral-500">Podpis žáka</th>
              </tr>
            </thead>
            <tbody>
              {vycvik.map((x) => (
                <tr
                  key={x.t.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className="text-neutral-500">{nazevDne(x.t.zacatek)} </span>
                    <span className="tabular-nums">
                      {x.t.zacatek.toLocaleDateString("cs-CZ")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {rozsah(x.t.zacatek, x.t.delkaMinut)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{naHodiny(x.t.delkaMinut)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {x.ucitel ? `${x.ucitel.jmeno} ${x.ucitel.prijmeni}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {x.vozidlo ? `${x.vozidlo.znacka} ${x.vozidlo.rz}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">
                    {x.t.kmZacatek !== null && x.t.kmKonec !== null
                      ? `${x.t.kmZacatek} → ${x.t.kmKonec}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {x.t.kmZacatek !== null && x.t.kmKonec !== null
                      ? `${x.t.kmKonec - x.t.kmZacatek} km`
                      : "—"}
                  </td>
                  <td className="py-1.5">
                    <PodpisNahled kresba={podpisTerminu.get(x.t.id) ?? null} vyska={36} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {vycvikChybi > 0 ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            V sestavě není {vycvikChybi} jízd, které nebyly ukončeny se stavem
            tachometru.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Souhrn
        </h2>

        {predmety.length > 0 ? (
          <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {predmety.map((p) => {
              const mel = hodinPredmetu.get(p.klic) ?? 0;
              const potreba = konzultaciZaPredmet(p.hodin);
              const hotovo = mel >= potreba;
              return (
                <li
                  key={p.klic}
                  className={
                    hotovo
                      ? "flex justify-between gap-3 text-sm text-emerald-600 dark:text-emerald-400"
                      : "flex justify-between gap-3 text-sm"
                  }
                >
                  <span>{p.nazev}</span>
                  <span className="tabular-nums">
                    {hotovo ? `splněno · ${mel} h` : `${mel} h z ${potreba} h`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-2 text-sm">
          Výcvik: <span className="tabular-nums">{Math.round(hodinJizd * 10) / 10}</span>{" "}
          h
          {cilJizd ? <span className="text-neutral-500"> z {cilJizd} h</span> : null}
          {kmCelkem > 0 ? (
            <>
              {" · najeto "}
              <span className="tabular-nums">{kmCelkem}</span> km
            </>
          ) : null}
        </p>

        {!sOsnovou ? (
          <p className="mt-1 text-xs text-neutral-500">
            U přezkoušení osnova počet konzultací ani jízd nepředepisuje — hodiny
            se jen evidují.
          </p>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <Tisk />
        <p className="netisknout text-xs text-neutral-500">
          Tiskne se sestava včetně podpisů, bez menu a tlačítek.
        </p>
      </div>
    </main>
  );
}
