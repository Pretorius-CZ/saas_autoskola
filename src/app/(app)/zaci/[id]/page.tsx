import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum, vekKDatu } from "@/lib/datum";
import { formatTelefon } from "@/lib/telefon";
import { spocitejLhuty, type StavLhuty } from "@/lib/lhuty";
import { desifruj } from "@/lib/sifrovani";
import Milniky from "./milniky";

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

function barva(stav: StavLhuty) {
  switch (stav) {
    case "propadlo":
      return "bg-red-500";
    case "blizi_se":
      return "bg-amber-500";
    case "splneno":
      return "bg-emerald-500";
    case "bezi":
      return "bg-neutral-400";
    default:
      return "bg-neutral-300 dark:bg-neutral-700";
  }
}

function Radek({ popis, hodnota }: { popis: string; hodnota: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 sm:block sm:py-0">
      <dt className="text-sm text-neutral-500">{popis}</dt>
      <dd className="text-right sm:text-left">{hodnota ?? "—"}</dd>
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

  const [zaznam] = await proAutoskolu(kdo.autoskola.id, (tx) =>
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
  const lhuty = spocitejLhuty(v);

  // Zákonného zástupce neevidujeme — jen připomínáme, že podpis je potřeba.
  const vekPriPodani = v.datumPodaniZadosti
    ? vekKDatu(z.datumNarozeni, v.datumPodaniZadosti)
    : null;

  // Rodné číslo se rozšifruje až tady, pro zobrazení. V databázi ani
  // v odpovědi ze seznamu nikde v čitelné podobě není.
  const rodneCislo = desifruj(z.rodneCisloSifr);

  return (
    <main className="space-y-8">
      <div>
        <Link href="/zaci" className="text-sm text-neutral-500 underline-offset-4 hover:underline">
          ← Žáci
        </Link>
        <h1 className="mt-2 text-lg font-semibold">
          <span className="tabular-nums text-neutral-500">{v.evidencniCislo}</span>{" "}
          {z.titul ? `${z.titul} ` : ""}
          {z.jmeno} {z.prijmeni}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          skupina {v.skupina} · {DRUHY[v.druh] ?? v.druh} · {STAVY[v.stav] ?? v.stav}
        </p>
      </div>

      {vekPriPodani !== null && vekPriPodani < 18 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Při podání žádosti bylo žadateli {vekPriPodani} let — na žádosti musí být
          podpis zákonného zástupce
          {vekPriPodani < 15 ? ", a to úředně ověřený" : ""}.
        </p>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Zákonné lhůty</h2>
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {lhuty.map((l) => (
            <li key={l.klic} className="flex items-baseline gap-3 py-3">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${barva(l.stav)}`} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">
                    {l.nazev}{" "}
                    <span className="text-sm font-normal text-neutral-400">{l.paragraf}</span>
                  </span>
                  <span
                    className={
                      l.stav === "propadlo"
                        ? "text-sm font-medium text-red-600 dark:text-red-400"
                        : l.stav === "blizi_se"
                          ? "text-sm text-amber-600 dark:text-amber-400"
                          : "text-sm text-neutral-500"
                    }
                  >
                    {l.detail}
                  </span>
                </p>
                <p className="text-sm text-neutral-500">{l.popis}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Průběh</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Stav výcviku se nenastavuje ručně — vyplývá z dat níž.
        </p>
        <Milniky
          hodnoty={{
            id: v.id,
            datumZahajeni: v.datumZahajeni,
            datumUkonceni: v.datumUkonceni,
            datumPrihlasky: v.datumPrihlasky,
            datumPrvniZkousky: v.datumPrvniZkousky,
            datumDokonceni: v.datumDokonceni,
          }}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Žadatel</h2>
        <dl className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Radek popis="Datum narození" hodnota={formatDatum(z.datumNarozeni)} />
          <Radek popis="Místo narození" hodnota={z.mistoNarozeni} />
          <Radek
            popis="Rodné číslo"
            hodnota={
              rodneCislo ? (
                <span className="tabular-nums">{rodneCislo}</span>
              ) : z.rodneCisloKonec ? (
                <span className="text-neutral-400">… {z.rodneCisloKonec} (nelze rozšifrovat)</span>
              ) : null
            }
          />
          <Radek popis="Státní příslušnost" hodnota={z.statniPrislusnost} />
          <Radek popis="Rodné příjmení" hodnota={z.rodnePrijmeni} />
          <Radek
            popis="Doklad totožnosti"
            hodnota={z.dokladCislo ? `${z.dokladTyp ?? ""} ${z.dokladCislo}`.trim() : null}
          />
          <Radek
            popis="Adresa"
            hodnota={
              z.ulice || z.mesto
                ? [z.ulice, [z.psc, z.mesto].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ")
                : null
            }
          />
          <Radek
            popis="Kontakt"
            hodnota={
              [z.telefon ? formatTelefon(z.telefon) : null, z.email]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Výcvik</h2>
        <dl className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Radek popis="Evidenční číslo" hodnota={<span className="tabular-nums">{v.evidencniCislo}</span>} />
          <Radek popis="Učitel" hodnota={u ? `${u.jmeno} ${u.prijmeni}` : null} />
          <Radek popis="Lékařský posudek" hodnota={formatDatum(v.lekarskyPosudek)} />
          <Radek popis="Podání žádosti" hodnota={formatDatum(v.datumPodaniZadosti)} />
          <Radek popis="Úřad podle bydliště" hodnota={v.orpBydliste} />
          <Radek popis="Úřad autoškoly" hodnota={kdo.autoskola.orpPodani} />
          {v.ridicskyPrukazCislo || v.stavajiciSkupiny ? (
            <>
              <Radek popis="Řidičský průkaz" hodnota={v.ridicskyPrukazCislo} />
              <Radek popis="Stávající skupiny" hodnota={v.stavajiciSkupiny} />
            </>
          ) : null}
        </dl>
      </section>
    </main>
  );
}
