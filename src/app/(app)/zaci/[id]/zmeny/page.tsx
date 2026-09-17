import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { users, vycviky, zaci, zmeny } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { formatDatum } from "@/lib/datum";

export const dynamic = "force-dynamic";

/** Lidské názvy sloupců. Co tu není, ukáže se tak, jak je v databázi. */
const NAZVY: Record<string, string> = {
  jmeno: "Jméno",
  prijmeni: "Příjmení",
  titul: "Titul",
  rodne_prijmeni: "Rodné příjmení",
  datum_narozeni: "Datum narození",
  misto_narozeni: "Místo narození",
  statni_prislusnost: "Státní příslušnost",
  rodne_cislo_sifr: "Rodné číslo",
  rodne_cislo_konec: "Rodné číslo (konec)",
  ulice: "Ulice",
  mesto: "Obec",
  psc: "PSČ",
  telefon: "Telefon",
  email: "E-mail",
  doklad_typ: "Doklad totožnosti",
  doklad_cislo: "Číslo dokladu",
  evidencni_cislo: "Evidenční číslo",
  skupina: "Skupina",
  druh: "Druh",
  lekarsky_posudek: "Lékařský posudek",
  datum_podani_zadosti: "Podání žádosti",
  datum_zahajeni: "Zahájení výcviku",
  datum_ukonceni: "Ukončení výcviku",
  datum_prihlasky: "Přihláška ke zkoušce",
  datum_prvni_zkousky: "První zkouška",
  datum_dokonceni: "Dokončení zkoušek",
  orp_bydliste: "Úřad podle bydliště",
  ucitel_id: "Učitel",
  stav: "Stav",
  ridicsky_prukaz_cislo: "Číslo řidičského průkazu",
  stavajici_skupiny: "Stávající skupiny",
  poznamka: "Poznámka",
};

const AKCE: Record<string, string> = {
  vznik: "záznam vznikl",
  zmena: "změna",
  smazani: "záznam smazán",
};

const KDE: Record<string, string> = {
  zaci: "žadatel",
  vycviky: "výcvik",
};

function hodnota(v: string | null) {
  if (v === null || v === "") return <span className="text-neutral-400">—</span>;
  // Data v databázi jsou "2026-09-17"; ukaž je česky.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDatum(v);
  return v;
}

export default async function ZmenyZaka({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [zaznam] = await tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!zaznam) return null;

    // Historie žáka i jeho výcviku dohromady — pro člověka je to jedna věc.
    const radky = await tx
      .select()
      .from(zmeny)
      .where(
        and(
          eq(zmeny.tenantId, kdo.autoskola.id),
          or(eq(zmeny.zaznamId, zaznam.v.id), eq(zmeny.zaznamId, zaznam.z.id)),
        ),
      )
      .orderBy(desc(zmeny.kdy));

    const idUzivatelu = [...new Set(radky.map((r) => r.uzivatelId).filter(Boolean))] as string[];
    const lide = idUzivatelu.length
      ? await tx
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, idUzivatelu))
      : [];

    return { zaznam, radky, lide };
  });

  if (!data) notFound();

  const { zaznam, radky, lide } = data;
  const jmenaLidi = new Map(lide.map((u) => [u.id, u.name]));

  return (
    <main className="space-y-4">
      <div>
        <Link
          href={`/zaci/${zaznam.v.id}`}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Zpět na kartu
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">
            Historie změn{" "}
            <span className="font-normal text-neutral-500">
              č. {zaznam.v.evidencniCislo} · {zaznam.z.jmeno} {zaznam.z.prijmeni}
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            {radky.length} {radky.length === 1 ? "záznam" : radky.length < 5 ? "záznamy" : "záznamů"}
          </p>
        </div>
      </div>

      {radky.length === 0 ? (
        <p className="text-sm text-neutral-500">Zatím tu nic není.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Kdy</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Kde</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Údaj</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Původní</th>
                <th className="py-2 pr-3 text-xs font-medium text-neutral-500">Nová</th>
                <th className="py-2 text-xs font-medium text-neutral-500">Kdo</th>
              </tr>
            </thead>
            <tbody>
              {radky.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-neutral-500">
                    {r.kdy.toLocaleString("cs-CZ")}
                  </td>
                  <td className="py-1.5 pr-3 text-neutral-500">
                    {KDE[r.tabulka] ?? r.tabulka}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.akce === "zmena"
                      ? (NAZVY[r.pole ?? ""] ?? r.pole)
                      : (AKCE[r.akce] ?? r.akce)}
                  </td>
                  <td className="py-1.5 pr-3">{r.akce === "zmena" ? hodnota(r.hodnotaPred) : null}</td>
                  <td className="py-1.5 pr-3">{r.akce === "zmena" ? hodnota(r.hodnotaPo) : null}</td>
                  <td className="py-1.5 text-neutral-500">
                    {r.uzivatelId ? (jmenaLidi.get(r.uzivatelId) ?? "—") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Záznamy do historie zapisuje databáze sama a nejdou upravit ani smazat.
        U rodného čísla se zaznamenává jen to, že se změnilo — hodnota ne.
      </p>
    </main>
  );
}
