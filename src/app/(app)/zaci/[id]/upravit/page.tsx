import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { ucitele, vycviky, zaci } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { desifruj } from "@/lib/sifrovani";
import FormularZaka from "@/components/formular-zaka";
import { upravZaka } from "./akce";

export const dynamic = "force-dynamic";

export default async function UpravaZaka({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const { zaznam, seznamUcitelu } = await proAutoskolu(kdo, async (tx) => {
    const [zaznam] = await tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    const seznamUcitelu = await tx
      .select({ id: ucitele.id, jmeno: ucitele.jmeno, prijmeni: ucitele.prijmeni })
      .from(ucitele)
      .where(and(eq(ucitele.tenantId, kdo.autoskola.id), eq(ucitele.aktivni, true)))
      .orderBy(asc(ucitele.prijmeni));

    return { zaznam, seznamUcitelu };
  });

  if (!zaznam) notFound();

  const { v, z } = zaznam;

  return (
    <main>
      <Link
        href={`/zaci/${v.id}`}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        ← Zpět na kartu
      </Link>

      <h1 className="mt-2 text-lg font-semibold">
        Úprava žáka{" "}
        <span className="font-normal text-neutral-500">
          č. {v.evidencniCislo} · {z.jmeno} {z.prijmeni}
        </span>
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Evidenční číslo si vede autoškola podle své knihy — tady se dá přepsat.
      </p>

      <div className="mt-4">
        <FormularZaka
          ucitele={seznamUcitelu}
          akceFormulare={upravZaka}
          skryta={{ id: v.id }}
          pocatecni={{
            jmeno: z.jmeno,
            prijmeni: z.prijmeni,
            titul: z.titul ?? "",
            rodnePrijmeni: z.rodnePrijmeni ?? "",
            rodneCislo: desifruj(z.rodneCisloSifr) ?? "",
            datumNarozeni: z.datumNarozeni,
            mistoNarozeni: z.mistoNarozeni ?? "",
            statniPrislusnost: z.statniPrislusnost ?? "ČR",
            ulice: z.ulice ?? "",
            mesto: z.mesto ?? "",
            psc: z.psc ?? "",
            telefon: z.telefon ?? "",
            email: z.email ?? "",
            dokladTyp: z.dokladTyp ?? "občanský průkaz",
            dokladCislo: z.dokladCislo ?? "",
            skupina: v.skupina,
            druh: v.druh,
            lekarskyPosudek: v.lekarskyPosudek ?? "",
            datumPodaniZadosti: v.datumPodaniZadosti ?? "",
            orpBydliste: v.orpBydliste ?? "",
            ucitelId: v.ucitelId ?? "",
            ridicskyPrukazCislo: v.ridicskyPrukazCislo ?? "",
            evidencniCislo: String(v.evidencniCislo),
          }}
          pocatecniSkupiny={
            v.stavajiciSkupiny
              ? v.stavajiciSkupiny.split(",").map((s) => s.trim()).filter(Boolean)
              : []
          }
          popisTlacitka="Uložit změny"
          popisPrubehu="Ukládám…"
          zpetOdkaz={`/zaci/${v.id}`}
          sEvidencnimCislem
        />
      </div>
    </main>
  );
}
