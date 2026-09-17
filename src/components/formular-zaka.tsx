"use client";

import { useActionState, useEffect, useState } from "react";
import type { HodnotyZaka, StavFormulare } from "@/lib/typy-formulare";
import { KONTROLA_KONTROLNIHO_SOUCTU, datumNarozeniZRodnehoCisla } from "@/lib/rodne-cislo";
import { posudVek } from "@/lib/vek";
import { dnesek, formatDatum, vekKDatu } from "@/lib/datum";

type Ucitel = { id: string; jmeno: string; prijmeni: string };

const SKUPINY = ["AM", "A1", "A2", "A", "B", "B+E", "B96"];

// Z čeho se dá rozšiřovat. AM a T tu schválně nejsou — z těch
// se nerozšiřuje, takže by v nabídce jen pletly.
const SKUPINY_V_PRUKAZU = [
  "A1", "A2", "A",
  "B1", "B", "B+E", "B96",
  "C1", "C1+E", "C", "C+E",
  "D1", "D1+E", "D", "D+E",
];

type Hodnoty = Record<string, string>;

function vychozi(): Hodnoty {
  return {
    jmeno: "", prijmeni: "", titul: "", rodnePrijmeni: "",
    rodneCislo: "", datumNarozeni: "", mistoNarozeni: "", statniPrislusnost: "ČR",
    ulice: "", mesto: "", psc: "", telefon: "", email: "",
    dokladTyp: "občanský průkaz", dokladCislo: "",
    skupina: "B", druh: "prvni", lekarskyPosudek: "", datumPodaniZadosti: dnesek(),
    orpBydliste: "", ucitelId: "", ridicskyPrukazCislo: "", evidencniCislo: "",
  };
}

/**
 * Sloučí předvyplněné hodnoty s výchozími.
 *
 * Klíč, který má `undefined`, se zahodí. Prostý `{...vychozi(), ...pocatecni}`
 * by ho totiž přepsal na `undefined` a Reactu by se pole přepnulo z řízeného
 * na neřízené — což se projeví až za běhu a špatně se to hledá.
 */
function slouc(pocatecni?: Partial<HodnotyZaka>): Hodnoty {
  const h = vychozi();
  if (!pocatecni) return h;

  for (const [klic, hodnota] of Object.entries(pocatecni)) {
    if (typeof hodnota === "string") h[klic] = hodnota;
  }
  return h;
}

const vstup =
  "w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-neutral-900";
const bezny = "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700";
const chybny = "border-red-500 focus:border-red-600 dark:border-red-500";

/** Tenký předěl místo nadpisu sekce — odděluje, ale nezabírá řádek navíc. */
function Predel({ popis }: { popis: string }) {
  return (
    <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {popis}
      </span>
      <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}

/**
 * Jedno políčko formuláře.
 *
 * MUSÍ být tady, na úrovni souboru. Kdyby bylo definované uvnitř
 * komponenty formuláře, React by ho při každém stisku klávesy považoval
 * za nový prvek, staré políčko by zahodil a kurzor by zmizel.
 * Přesně to se tu jednou stalo.
 *
 * `sirka` je počet sloupců ze šesti (na širší obrazovce).
 */
function Pole({
  klic,
  popis,
  sirka,
  hodnota,
  zmen,
  tridy,
  typ = "text",
  povinne = true,
  pod,
  ...zbytek
}: {
  klic: string;
  popis: string;
  sirka: number;
  hodnota: string;
  zmen: (klic: string) => (e: { target: { value: string } }) => void;
  tridy: (klic: string) => string;
  typ?: string;
  povinne?: boolean;
  pod?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className={`block ${sloupce[sirka]}`}>
      <span className="text-xs text-neutral-500">
        {popis}
        {povinne ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        name={klic}
        type={typ}
        required={povinne}
        value={hodnota}
        onChange={zmen(klic)}
        {...zbytek}
        className={`mt-0.5 ${tridy(klic)}`}
      />
      {pod}
    </label>
  );
}

type Vlastnosti = {
  ucitele: Ucitel[];
  /** Server action, která formulář zpracuje. Přijetí i úprava mají vlastní. */
  akceFormulare: (stav: StavFormulare, data: FormData) => Promise<StavFormulare>;
  /** Předvyplněné hodnoty — u úpravy to, co je v databázi. */
  pocatecni?: Partial<HodnotyZaka>;
  /** Skupiny z řidičského průkazu, které mají být naklikané. */
  pocatecniSkupiny?: string[];
  /** Skrytá pole, která se odešlou spolu s formulářem (např. id výcviku). */
  skryta?: Record<string, string>;
  popisTlacitka: string;
  popisPrubehu: string;
  /** Řádek pod tlačítkem. */
  poznamka?: string;
  /** Kam vede odkaz „Zpět bez uložení". */
  zpetOdkaz?: string;
  /** Ukázat pole s evidenčním číslem (jen při úpravě, ne při přijetí). */
  sEvidencnimCislem?: boolean;
};

export default function FormularZaka({
  ucitele,
  akceFormulare,
  pocatecni,
  pocatecniSkupiny,
  skryta,
  popisTlacitka,
  popisPrubehu,
  poznamka,
  zpetOdkaz,
  sEvidencnimCislem,
}: Vlastnosti) {
  const [stav, akce, probiha] = useActionState<StavFormulare, FormData>(akceFormulare, {});

  /**
   * Formulář si drží hodnoty sám: React po odeslání políčka vyprázdní
   * a rozbalovací seznamy by spadly na výchozí hodnotu.
   */
  const [h, setH] = useState<Hodnoty>(() => slouc(pocatecni));
  const [doplnenoSamo, setDoplnenoSamo] = useState(false);
  const [napovedaData, setNapovedaData] = useState<string | null>(null);
  const [skupinyZPrukazu, setSkupinyZPrukazu] = useState<string[]>(pocatecniSkupiny ?? []);

  const zmen = (klic: string) => (e: { target: { value: string } }) =>
    setH((p) => ({ ...p, [klic]: e.target.value }));

  useEffect(() => {
    if (stav.hodnoty) setH((p) => ({ ...p, ...stav.hodnoty }));
  }, [stav]);

  useEffect(() => {
    if (!stav.pole) return;
    const prvek = document.querySelector<HTMLElement>(`[name="${stav.pole}"]`);
    prvek?.focus();
    prvek?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [stav]);

  const tridy = (klic: string) => `${vstup} ${stav.pole === klic ? chybny : bezny}`;

  /**
   * Datum narození dopočítáme z rodného čísla, ale až když z pole odejdeš.
   * Během psaní vypadá desetimístné číslo chvíli jako devítimístné a ta
   * se přidělovala do roku 1953 — z roku 2010 by vyšel rok 1910.
   */
  function zRodnehoCisla() {
    const spocitane = datumNarozeniZRodnehoCisla(h.rodneCislo);
    setNapovedaData(null);
    if (!spocitane) return;

    if (!h.datumNarozeni || doplnenoSamo) {
      setH((p) => ({ ...p, datumNarozeni: spocitane }));
      setDoplnenoSamo(true);
    } else if (h.datumNarozeni !== spocitane) {
      setNapovedaData(`Podle rodného čísla ${formatDatum(spocitane)}`);
    }
  }

  const vekPriPodani = h.datumNarozeni
    ? vekKDatu(h.datumNarozeni, h.datumPodaniZadosti || dnesek())
    : null;

  const posudek =
    h.datumNarozeni && h.skupina
      ? posudVek(h.datumNarozeni, h.skupina, h.datumPodaniZadosti || dnesek())
      : null;

  return (
    <form action={akce} className="space-y-4">
      {skryta
        ? Object.entries(skryta).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <Predel popis="Žadatel" />

        <Pole klic="jmeno" popis="Jméno" sirka={2}
          hodnota={h.jmeno}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="prijmeni" popis="Příjmení" sirka={2}
          hodnota={h.prijmeni}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="titul" popis="Titul" sirka={1} povinne={false}
          hodnota={h.titul}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="rodnePrijmeni" popis="Rodné příjmení" sirka={1} povinne={false}
          hodnota={h.rodnePrijmeni}
          zmen={zmen}
          tridy={tridy}
        />

        <Pole
          klic="rodneCislo"
          popis="Rodné číslo"
          sirka={2}
          inputMode="numeric"
          placeholder="9401011235"
          onBlur={zRodnehoCisla}
          hodnota={h.rodneCislo}
          zmen={zmen}
          tridy={tridy}
          pod={
            KONTROLA_KONTROLNIHO_SOUCTU ? null : (
              <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
                kontrolní součet vypnutý
              </span>
            )
          }
        />
        <label className={`block ${sloupce[2]}`}>
          <span className="text-xs text-neutral-500">
            Datum narození<span className="text-red-500"> *</span>
          </span>
          <input
            type="date"
            name="datumNarozeni"
            required
            value={h.datumNarozeni}
            onChange={(e) => {
              setDoplnenoSamo(false);
              setNapovedaData(null);
              zmen("datumNarozeni")(e);
            }}
            className={`mt-0.5 ${tridy("datumNarozeni")}`}
          />
          {napovedaData ? (
            <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
              {napovedaData}
            </span>
          ) : null}
        </label>
        <Pole klic="mistoNarozeni" popis="Místo narození" sirka={2}
          hodnota={h.mistoNarozeni}
          zmen={zmen}
          tridy={tridy}
        />

        <Pole klic="statniPrislusnost" popis="Státní příslušnost" sirka={2}
          hodnota={h.statniPrislusnost}
          zmen={zmen}
          tridy={tridy}
        />
        <label className={`block ${sloupce[2]}`}>
          <span className="text-xs text-neutral-500">
            Doklad totožnosti<span className="text-red-500"> *</span>
          </span>
          <select
            name="dokladTyp"
            value={h.dokladTyp}
            onChange={zmen("dokladTyp")}
            className={`mt-0.5 ${tridy("dokladTyp")}`}
          >
            <option>občanský průkaz</option>
            <option>cestovní pas</option>
            <option>povolení k pobytu</option>
          </select>
        </label>
        <Pole klic="dokladCislo" popis="Číslo dokladu" sirka={2}
          hodnota={h.dokladCislo}
          zmen={zmen}
          tridy={tridy}
        />

        <Pole klic="ulice" popis="Ulice a číslo popisné" sirka={3}
          hodnota={h.ulice}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="mesto" popis="Obec" sirka={2}
          hodnota={h.mesto}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="psc" popis="PSČ" sirka={1} inputMode="numeric"
          hodnota={h.psc}
          zmen={zmen}
          tridy={tridy}
        />

        <Pole
          klic="telefon"
          popis="Telefon"
          sirka={2}
          typ="tel"
          inputMode="numeric"
          placeholder="601 111 111"
          hodnota={h.telefon}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="email" popis="E-mail" sirka={2} typ="email" povinne={false}
          hodnota={h.email}
          zmen={zmen}
          tridy={tridy}
        />
        <Pole klic="orpBydliste" popis="Úřad (ORP) podle bydliště" sirka={2}
          hodnota={h.orpBydliste}
          zmen={zmen}
          tridy={tridy}
        />

        <Predel popis="Výcvik" />

        <label className={`block ${sloupce[1]}`}>
          <span className="text-xs text-neutral-500">
            Skupina<span className="text-red-500"> *</span>
          </span>
          <select
            name="skupina"
            required
            value={h.skupina}
            onChange={zmen("skupina")}
            className={`mt-0.5 ${tridy("skupina")}`}
          >
            {SKUPINY.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>

        {sEvidencnimCislem ? (
          <Pole
            klic="evidencniCislo"
            popis="Evidenční číslo"
            sirka={1}
            inputMode="numeric"
            hodnota={h.evidencniCislo}
            zmen={zmen}
            tridy={tridy}
            pod={
              <span className="mt-0.5 block text-xs text-neutral-500">
                číslo v evidenční knize
              </span>
            }
          />
        ) : null}

        <label className={`block ${sloupce[sEvidencnimCislem ? 1 : 2]}`}>
          <span className="text-xs text-neutral-500">Druh</span>
          <select
            name="druh"
            value={h.druh}
            onChange={(e) => {
              // U přezkoušení jde skoro vždycky o skupinu B, tak ji nabídneme.
              if (e.target.value === "bodovy" && skupinyZPrukazu.length === 0) {
                setSkupinyZPrukazu(["B"]);
              }
              zmen("druh")(e);
            }}
            className={`mt-0.5 ${tridy("druh")}`}
          >
            <option value="prvni">první řidičské oprávnění</option>
            <option value="rozsireni">rozšíření</option>
            <option value="bodovy">přezkoušení (bodový)</option>
          </select>
        </label>

        <label className={`block ${sloupce[3]}`}>
          <span className="text-xs text-neutral-500">Učitel</span>
          <select
            name="ucitelId"
            value={h.ucitelId}
            onChange={zmen("ucitelId")}
            className={`mt-0.5 ${tridy("ucitelId")}`}
          >
            <option value="">zatím nepřidělen</option>
            {ucitele.map((u) => (
              <option key={u.id} value={u.id}>
                {u.jmeno} {u.prijmeni}
              </option>
            ))}
          </select>
        </label>

        <Pole
          klic="lekarskyPosudek"
          popis="Lékařský posudek"
          sirka={3}
          typ="date"
          povinne={false}
          hodnota={h.lekarskyPosudek}
          zmen={zmen}
          tridy={tridy}
          pod={
            <span className="mt-0.5 block text-xs text-neutral-500">
              při podání nesmí být starší tří měsíců (§ 13)
            </span>
          }
        />
        <Pole klic="datumPodaniZadosti" popis="Podání žádosti" sirka={3} typ="date"
          hodnota={h.datumPodaniZadosti}
          zmen={zmen}
          tridy={tridy}
        />

        {vekPriPodani !== null && vekPriPodani < 18 ? (
          <p className="col-span-full rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Žadateli je {vekPriPodani} let — žádost musí podepsat i zákonný zástupce
            {vekPriPodani < 15 ? " a jeho podpis musí být úředně ověřený" : ""}. Zástupce
            neevidujeme, hlídá to papír.
          </p>
        ) : null}

        {posudek ? (
          <p
            className={`col-span-full text-xs ${
              !posudek.ok
                ? "text-red-600 dark:text-red-400"
                : posudek.dosazeniVeku &&
                    posudek.dosazeniVeku > (h.datumPodaniZadosti || dnesek())
                  ? "text-amber-600 dark:text-amber-400"
                  : "hidden"
            }`}
          >
            {!posudek.ok
              ? `Na výcvik skupiny ${h.skupina} je ještě brzy — nejdřív ${formatDatum(posudek.nejdriv)}.`
              : `Výcvik zahájit může, oprávnění získá až ${formatDatum(posudek.dosazeniVeku)}.`}
          </p>
        ) : null}

        {h.druh !== "prvni" ? (
          <>
            <Predel popis="Stávající řidičské oprávnění" />

            <Pole klic="ridicskyPrukazCislo" popis="Číslo řidičského průkazu" sirka={2}
          hodnota={h.ridicskyPrukazCislo}
          zmen={zmen}
          tridy={tridy}
        />

            <fieldset className="col-span-full sm:col-span-4">
              <legend className="text-xs text-neutral-500">
                Skupiny, které už má<span className="text-red-500"> *</span>
              </legend>
              <div
                className={`mt-0.5 flex flex-wrap gap-1.5 rounded-md border p-1.5 ${
                  stav.pole === "stavajiciSkupiny" ? chybny : "border-transparent"
                }`}
              >
                {SKUPINY_V_PRUKAZU.map((s) => {
                  const zaskrtnuta = skupinyZPrukazu.includes(s);
                  return (
                    <label
                      key={s}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                        zaskrtnuta
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                          : "border-neutral-300 dark:border-neutral-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="stavajiciSkupiny"
                        value={s}
                        checked={zaskrtnuta}
                        onChange={(e) =>
                          setSkupinyZPrukazu((p) =>
                            e.target.checked ? [...p, s] : p.filter((x) => x !== s),
                          )
                        }
                        className="sr-only"
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : null}
      </div>

      {stav.chyba ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {stav.chyba}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button
          type="submit"
          disabled={probiha}
          className="tlacitko"
        >
          {probiha ? popisPrubehu : popisTlacitka}
        </button>
        {zpetOdkaz ? (
          <a
            href={zpetOdkaz}
            className="text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            Zpět bez uložení
          </a>
        ) : null}
        {poznamka ? <p className="text-xs text-neutral-500">{poznamka}</p> : null}
        {stav.hotovo && !probiha ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Uloženo.</span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Šířky sloupců vypsané naplno.
 * Tailwind hledá názvy tříd v textu souboru, takže skládat je za běhu
 * (`sm:col-span-${n}`) nefunguje — tyhle třídy by se do stylů nedostaly.
 */
const sloupce: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
};
