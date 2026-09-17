import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum, vekKDatu } from "@/lib/datum";
import { formatTelefon } from "@/lib/telefon";
import { hlidani } from "@/lib/hlidani";
import { desifruj } from "@/lib/sifrovani";
import Prubeh from "./prubeh";
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

  const [zaznam] = await proAutoskolu(kdo, (tx) =>
    tx
      .select({ v: vycviky, z: zaci, u: ucitele })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .leftJoin(ucitele, eq(ucitele.id, vycviky.ucitelId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1),
  );

  if (!zaznam) notFound();

  const { v, z, u } = zaznam;
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
