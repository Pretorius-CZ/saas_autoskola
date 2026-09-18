import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { kurzy, terminy, ucast, ucitele, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum, vekKDatu } from "@/lib/datum";
import { formatTelefon } from "@/lib/telefon";
import { hlidani } from "@/lib/hlidani";
import {
  HODIN_VYCVIKU,
  PREDMETY,
  konzultaciCelkem,
  konzultaciZaPredmet,
  naHodiny,
  osnovaPredepisuje,
} from "@/lib/osnova";
import { denAMesic, nazevDne, rozsah } from "@/lib/cas";
import { desifruj } from "@/lib/sifrovani";
import { adresaAplikace } from "@/lib/env";
import Prubeh from "./prubeh";
import OdkazNaRozvrh from "./odkaz";
import Zruseni from "./zruseni";

export const dynamic = "force-dynamic";

const STAVY: Record<string, string> = {
  zadost: "žádost podána",
  vycvik: "ve výcviku",
  ukonceno: "výcvik ukončen",
  zkousky: "u zkoušek",
  dokonceno: "dokončeno",
  zruseno: "zrušeno",
};

const DRUHY: Record<string, string> = {
  prvni: "první řidičské oprávnění",
  rozsireni: "rozšíření",
  bodovy: "přezkoušení (bodový)",
};

/** Jeden údaj v hutné mřížce — stejná hustota jako ve formuláři úpravy. */
function Udaj({
  popis,
  hodnota,
  sirka = 2,
}: {
  popis: string;
  hodnota: React.ReactNode;
  sirka?: number;
}) {
  return (
    <div className={sloupce[sirka]}>
      <p className="text-xs text-neutral-500">{popis}</p>
      <p className="text-sm">{hodnota || <span className="text-neutral-400">—</span>}</p>
    </div>
  );
}

function Predel({ popis, vpravo }: { popis: string; vpravo?: React.ReactNode }) {
  return (
    <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {popis}
      </span>
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      {vpravo}
    </div>
  );
}

export default async function KartaZaka({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const nactene = await proAutoskolu(kdo, async (tx) => {
    const [zaznam] = await tx
      .select({ v: vycviky, z: zaci, u: ucitele, k: kurzy })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .leftJoin(ucitele, eq(ucitele.id, vycviky.ucitelId))
      .leftJoin(kurzy, eq(kurzy.id, vycviky.kurzId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!zaznam) return null;

    // Jeho jízdy a teorie jeho kurzu — pro něj je to jeden rozvrh.
    const jehoTerminy = await tx
      .select({ t: terminy, ucitel: ucitele, pritomen: ucast.pritomen })
      .from(terminy)
      .leftJoin(ucitele, eq(ucitele.id, terminy.ucitelId))
      // Docházka je vedená na žáka, ne na termín. Bez tohoto připojení
      // by se konzultace počítala každému v kurzu stejně — i tomu,
      // kdo nepřišel.
      .leftJoin(
        ucast,
        and(eq(ucast.terminId, terminy.id), eq(ucast.vycvikId, zaznam.v.id)),
      )
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

    return { zaznam, jehoTerminy };
  });

  if (!nactene) notFound();

  const { zaznam, jehoTerminy } = nactene;
  const { v, z, u, k } = zaznam;

  const ted = Date.now();
  const budouci = jehoTerminy.filter((x) => x.t.zacatek.getTime() >= ted);
  const probehle = jehoTerminy.filter((x) => x.t.zacatek.getTime() < ted);

  const minutJizd = probehle
    .filter((x) => x.t.druh === "jizda")
    .reduce((s, x) => s + x.t.delkaMinut, 0);

  // Konzultace se počítají po předmětech — jinak nejde poznat, jestli
  // má žák odbytou zdravotnickou přípravu, nebo jen pět hodin předpisů.
  //
  // Počítá se jen to, co má zapsanou docházku a u čeho byl žák označený
  // jako přítomný. Termín, který se konal, ale docházka u něj ještě není
  // zapsaná, se nepočítá nikomu — místo toho se níže vypíše, kolik
  // takových termínů čeká. Tichý odhad by u evidence, ze které se vydává
  // průkaz žadatele, byl horší než přiznaná mezera.
  const konzultacePodlePredmetu = new Map<string, number>();
  let konzultaceBezDochazky = 0;

  for (const x of probehle) {
    if (x.t.druh !== "teorie") continue;

    if (x.t.stav !== "probehlo") {
      konzultaceBezDochazky += 1;
      continue;
    }
    if (!x.pritomen) continue;

    const klic = x.t.predmet ?? "?";
    konzultacePodlePredmetu.set(
      klic,
      (konzultacePodlePredmetu.get(klic) ?? 0) + naHodiny(x.t.delkaMinut),
    );
  }

  // U přezkoušení osnova nic nepředepisuje — hodiny se jen počítají.
  const sOsnovou = osnovaPredepisuje(v.druh);
  const predmety = sOsnovou ? (PREDMETY[v.skupina] ?? []) : [];
  const cilJizd = sOsnovou ? HODIN_VYCVIKU[v.skupina] : undefined;
  const cilKonzultaci = sOsnovou ? konzultaciCelkem(v.skupina) : null;
  const konzultaciZatim = [...konzultacePodlePredmetu.values()].reduce((a, b) => a + b, 0);
  const upozorneni = hlidani(v);

  // Rodné číslo se rozšifruje až tady, pro zobrazení.
  const rodneCislo = desifruj(z.rodneCisloSifr);

  const vekPriPodani = v.datumPodaniZadosti
    ? vekKDatu(z.datumNarozeni, v.datumPodaniZadosti)
    : null;

  return (
    <main className="space-y-4">
      <div>
        <Link href="/zaci" className="text-xs text-neutral-500 underline-offset-4 hover:underline">
          ← Žáci
        </Link>

        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">
            <span className="tabular-nums text-neutral-500">{v.evidencniCislo}</span>{" "}
            {z.titul ? `${z.titul} ` : ""}
            {z.jmeno} {z.prijmeni}
          </h1>
          <p className="text-sm text-neutral-500">
            skupina {v.skupina} · {DRUHY[v.druh] ?? v.druh} · {STAVY[v.stav] ?? v.stav}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <a
            href={`/zaci/${v.id}/zadost`}
            target="_blank"
            rel="noopener"
            className="tlacitko"
          >
            Tisk žádosti
          </a>
          <Link
            href={`/zaci/${v.id}/upravit`}
            className="tlacitko-vedlejsi"
          >
            Upravit
          </Link>
          <Link
            href={`/zaci/${v.id}/zmeny`}
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            Historie změn
          </Link>
          <Zruseni id={v.id} zruseno={v.stav === "zruseno"} />
        </div>
      </div>

      {v.stav === "zruseno" ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          Výcvik je zrušený. Záznam zůstává v evidenci, evidenční číslo se nikomu
          jinému nepřidělí.
        </p>
      ) : null}

      {upozorneni.length > 0 ? (
        <ul className="space-y-1">
          {upozorneni.map((uz) => (
            <li
              key={uz.klic}
              title={uz.paragraf}
              className={
                uz.naléhavost === "propadlo"
                  ? "rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                  : uz.naléhavost === "blizi_se"
                    ? "rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "px-3 py-1.5 text-sm text-neutral-500"
              }
            >
              {uz.text}
            </li>
          ))}
        </ul>
      ) : null}

      {vekPriPodani !== null && vekPriPodani < 18 ? (
        <p className="rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Při podání žádosti bylo žadateli {vekPriPodani} let — na žádosti musí být
          podpis zákonného zástupce
          {vekPriPodani < 15 ? ", a to úředně ověřený" : ""}.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <Predel popis="Průběh" />

        <Prubeh
          id={v.id}
          podani={v.datumPodaniZadosti}
          pocatecni={{
            datumZahajeni: v.datumZahajeni,
            datumUkonceni: v.datumUkonceni,
            datumPrihlasky: v.datumPrihlasky,
            datumPrvniZkousky: v.datumPrvniZkousky,
            datumDokonceni: v.datumDokonceni,
          }}
        />

        <Predel popis="Výuka a výcvik" />

        <Udaj popis="Kurz" hodnota={k?.nazev} sirka={2} />
        <Udaj
          popis="Odjeto"
          hodnota={
            <>
              <span className="tabular-nums">{naHodiny(minutJizd)}</span>
              {cilJizd ? <span className="text-neutral-500"> z {cilJizd} h</span> : " h"}
            </>
          }
          sirka={2}
        />
        <Udaj
          popis={sOsnovou ? "Konzultace (ISP)" : "Konzultace"}
          hodnota={
            <>
              <span className="tabular-nums">{konzultaciZatim}</span>
              {cilKonzultaci ? (
                <span className="text-neutral-500"> z {cilKonzultaci} h</span>
              ) : (
                " h"
              )}
            </>
          }
          sirka={2}
        />

        {!sOsnovou ? (
          <p className="col-span-full text-xs text-neutral-500">
            U přezkoušení osnova počet konzultací ani jízd nepředepisuje — hodiny
            se jen evidují.
          </p>
        ) : null}

        {konzultaceBezDochazky > 0 ? (
          <p className="col-span-full text-xs text-amber-600 dark:text-amber-400">
            {konzultaceBezDochazky === 1
              ? "U jedné proběhlé konzultace zatím není zapsaná docházka — do počtu se nezapočítala."
              : `U ${konzultaceBezDochazky} proběhlých konzultací zatím není zapsaná docházka — do počtu se nezapočítaly.`}
          </p>
        ) : null}

        {predmety.length > 0 ? (
          <div className="col-span-full">
            <p className="text-xs text-neutral-500">Konzultace po předmětech</p>
            <ul className="mt-0.5 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {predmety.map((p) => {
                const mel = konzultacePodlePredmetu.get(p.klic) ?? 0;
                const potreba = konzultaciZaPredmet(p.hodin);
                const hotovo = mel >= potreba;
                return (
                  <li key={p.klic} className="flex justify-between gap-3 text-sm">
                    <span className={hotovo ? "text-neutral-500" : ""}>{p.nazev}</span>
                    <span
                      className={
                        hotovo
                          ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                          : "tabular-nums"
                      }
                    >
                      {mel} / {potreba}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <OdkazNaRozvrh
          adresa={`${adresaAplikace()}/rozvrh/${v.tokenRozvrhu}`}
          komu={z.email}
          jmeno={z.jmeno}
        />

        <div className="col-span-full">
          <p className="text-xs text-neutral-500">Nejbližší termíny</p>
          {budouci.length === 0 ? (
            <p className="text-sm text-neutral-400">
              nic naplánovaného —{" "}
              <Link href="/kalendar" className="underline underline-offset-4">
                naplánovat
              </Link>
            </p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {budouci.slice(0, 6).map((x) => (
                <li key={x.t.id} className="text-sm">
                  <Link
                    href={`/kalendar/${x.t.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    <span className="text-neutral-500">{nazevDne(x.t.zacatek)} </span>
                    <span className="tabular-nums">{denAMesic(x.t.zacatek)}</span>{" "}
                    <span className="tabular-nums">{rozsah(x.t.zacatek, x.t.delkaMinut)}</span>
                  </Link>
                  <span className="text-neutral-500">
                    {" · "}
                    {x.t.druh === "teorie" ? "teorie" : "jízda"}
                    {x.ucitel ? ` · ${x.ucitel.prijmeni}` : ""}
                    {x.t.misto ? ` · ${x.t.misto}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Predel popis="Žadatel" />

        <Udaj popis="Datum narození" hodnota={formatDatum(z.datumNarozeni)} />
        <Udaj popis="Místo narození" hodnota={z.mistoNarozeni} sirka={1} />
        <Udaj
          popis="Rodné číslo"
          hodnota={
            rodneCislo ? (
              <span className="tabular-nums">{rodneCislo}</span>
            ) : z.rodneCisloKonec ? (
              <span className="text-neutral-400">… {z.rodneCisloKonec}</span>
            ) : null
          }
        />
        <Udaj popis="Občanství" hodnota={z.statniPrislusnost} sirka={1} />

        <Udaj
          popis="Doklad totožnosti"
          hodnota={z.dokladCislo ? `${z.dokladTyp ?? ""} ${z.dokladCislo}`.trim() : null}
          sirka={3}
        />
        <Udaj popis="Rodné příjmení" hodnota={z.rodnePrijmeni} sirka={3} />

        <Udaj
          popis="Adresa"
          hodnota={
            z.ulice || z.mesto
              ? [z.ulice, [z.psc, z.mesto].filter(Boolean).join(" ")].filter(Boolean).join(", ")
              : null
          }
          sirka={4}
        />
        <Udaj
          popis="Kontakt"
          hodnota={
            [z.telefon ? formatTelefon(z.telefon) : null, z.email].filter(Boolean).join(" · ") ||
            null
          }
          sirka={2}
        />

        <Predel popis="Výcvik" />

        <Udaj popis="Lékařský posudek" hodnota={formatDatum(v.lekarskyPosudek)} sirka={1} />
        <Udaj popis="Učitel" hodnota={u ? `${u.jmeno} ${u.prijmeni}` : null} />
        <Udaj popis="Úřad podle bydliště" hodnota={v.orpBydliste} />
        <Udaj popis="Úřad autoškoly" hodnota={kdo.autoskola.orpPodani} sirka={1} />

        {v.ridicskyPrukazCislo || v.stavajiciSkupiny ? (
          <>
            <Udaj popis="Řidičský průkaz" hodnota={v.ridicskyPrukazCislo} />
            <Udaj popis="Stávající skupiny" hodnota={v.stavajiciSkupiny} sirka={4} />
          </>
        ) : null}
      </div>

    </main>
  );
}

/**
 * Šířky sloupců vypsané naplno — Tailwind hledá názvy tříd v textu souboru,
 * takže skládat je za běhu nefunguje.
 */
const sloupce: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
};
