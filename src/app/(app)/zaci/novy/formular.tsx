"use client";

import { useActionState, useEffect, useState } from "react";
import { prijmiZaka, type StavFormulare } from "./akce";
import { KONTROLA_KONTROLNIHO_SOUCTU, datumNarozeniZRodnehoCisla } from "@/lib/rodne-cislo";
import { posudVek } from "@/lib/vek";
import { dnesek, formatDatum } from "@/lib/datum";

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

const ramecek =
  "mt-1 w-full rounded-lg border bg-white px-3 py-2 text-base outline-none dark:bg-neutral-900";
const bezny = "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700";
const chybny = "border-red-500 focus:border-red-600 dark:border-red-500";

type Hodnoty = Record<string, string>;

function vychozi(): Hodnoty {
  return {
    jmeno: "",
    prijmeni: "",
    titul: "",
    rodnePrijmeni: "",
    rodneCislo: "",
    datumNarozeni: "",
    mistoNarozeni: "",
    statniPrislusnost: "ČR",
    ulice: "",
    mesto: "",
    psc: "",
    telefon: "",
    email: "",
    dokladTyp: "občanský průkaz",
    dokladCislo: "",
    zastupceJmeno: "",
    zastupceVztah: "",
    zastupceTelefon: "",
    skupina: "B",
    druh: "prvni",
    lekarskyPosudek: "",
    datumPodaniZadosti: dnesek(),
    orpBydliste: "",
    ucitelId: "",
    ridicskyPrukazCislo: "",
  };
}

export default function FormularPrijeti({ ucitele }: { ucitele: Ucitel[] }) {
  const [stav, akce, probiha] = useActionState<StavFormulare, FormData>(prijmiZaka, {});

  /**
   * Formulář si drží hodnoty sám.
   *
   * React po odeslání formulář vyprázdní a políčka vrátí do výchozího stavu.
   * U textových polí by se to dalo obejít, u rozbalovacích seznamů ne —
   * skupina by po každé chybě spadla zpátky na B. Proto si stav držíme tady.
   */
  const [h, setH] = useState<Hodnoty>(vychozi);

  // Doplnili jsme datum narození sami? Pak ho smíme přepsat.
  const [doplnenoSamo, setDoplnenoSamo] = useState(false);
  const [napovedaData, setNapovedaData] = useState<string | null>(null);
  const [skupinyZPrukazu, setSkupinyZPrukazu] = useState<string[]>([]);

  const zmen = (klic: string) => (e: { target: { value: string } }) =>
    setH((p) => ({ ...p, [klic]: e.target.value }));

  // Když se server ozve s chybou, vrátí s ní i to, co bylo odeslané.
  useEffect(() => {
    if (stav.hodnoty) setH((p) => ({ ...p, ...stav.hodnoty }));
  }, [stav]);

  // Po chybě skoč na pole, které je potřeba spravit.
  useEffect(() => {
    if (!stav.pole) return;
    const prvek = document.querySelector<HTMLElement>(`[name="${stav.pole}"]`);
    prvek?.focus();
    prvek?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [stav]);

  const jeChybne = (klic: string) => stav.pole === klic;
  const tridy = (klic: string) => `${ramecek} ${jeChybne(klic) ? chybny : bezny}`;

  /**
   * Datum narození je v rodném čísle obsažené, tak ho nechceme psát dvakrát.
   *
   * Až když z pole odejdeš, ne během psaní: desetimístné rodné číslo totiž
   * při psaní na chvíli vypadá jako devítimístné, a ta se přidělovala do
   * roku 1953 — z roku 2010 by vyšel rok 1910.
   */
  function zRodnehoCisla() {
    const spocitane = datumNarozeniZRodnehoCisla(h.rodneCislo);
    setNapovedaData(null);
    if (!spocitane) return;

    if (!h.datumNarozeni || doplnenoSamo) {
      setH((p) => ({ ...p, datumNarozeni: spocitane }));
      setDoplnenoSamo(true);
      setNapovedaData("Doplněno z rodného čísla.");
    } else if (h.datumNarozeni !== spocitane) {
      setNapovedaData(
        `Podle rodného čísla by to bylo ${formatDatum(spocitane)} — zkontroluj to.`,
      );
    }
  }

  // Věk se přepočítá při každé změně, bez čekání na odeslání.
  const posudek =
    h.datumNarozeni && h.skupina
      ? posudVek(h.datumNarozeni, h.skupina, h.datumPodaniZadosti || dnesek())
      : null;

  return (
    <form action={akce} className="space-y-6">
      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Žadatel</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Horní část žádosti — vyplňuje ji žadatel sám, nebo ji podle občanky opíšeš ty.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-neutral-500">
              Jméno<span className="text-red-500"> *</span>
            </span>
            <input name="jmeno" required value={h.jmeno} onChange={zmen("jmeno")} className={tridy("jmeno")} />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">
              Příjmení<span className="text-red-500"> *</span>
            </span>
            <input
              name="prijmeni"
              required
              value={h.prijmeni}
              onChange={zmen("prijmeni")}
              className={tridy("prijmeni")}
            />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Titul</span>
            <input name="titul" value={h.titul} onChange={zmen("titul")} className={tridy("titul")} />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Rodné příjmení</span>
            <input
              name="rodnePrijmeni"
              value={h.rodnePrijmeni}
              onChange={zmen("rodnePrijmeni")}
              className={tridy("rodnePrijmeni")}
            />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">
              Rodné číslo<span className="text-red-500"> *</span>
            </span>
            <input
              name="rodneCislo"
              required
              inputMode="numeric"
              placeholder="9401011235"
              value={h.rodneCislo}
              onChange={zmen("rodneCislo")}
              onBlur={zRodnehoCisla}
              className={tridy("rodneCislo")}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Lomítko psát nemusíš. Ukládá se zašifrované.
            </span>
            {KONTROLA_KONTROLNIHO_SOUCTU ? null : (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                Kontrolní součet je dočasně vypnutý kvůli zkoušení.
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">
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
              className={tridy("datumNarozeni")}
            />
            {napovedaData ? (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                {napovedaData}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Místo narození</span>
            <input
              name="mistoNarozeni"
              value={h.mistoNarozeni}
              onChange={zmen("mistoNarozeni")}
              className={tridy("mistoNarozeni")}
            />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Státní příslušnost</span>
            <input
              name="statniPrislusnost"
              value={h.statniPrislusnost}
              onChange={zmen("statniPrislusnost")}
              className={tridy("statniPrislusnost")}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Adresa trvalého pobytu</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm text-neutral-500">Ulice a číslo popisné</span>
            <input name="ulice" value={h.ulice} onChange={zmen("ulice")} className={tridy("ulice")} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Obec</span>
            <input name="mesto" value={h.mesto} onChange={zmen("mesto")} className={tridy("mesto")} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">PSČ</span>
            <input
              name="psc"
              inputMode="numeric"
              value={h.psc}
              onChange={zmen("psc")}
              className={tridy("psc")}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Kontakt a doklad</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-neutral-500">Telefon</span>
            <input
              type="tel"
              name="telefon"
              inputMode="numeric"
              placeholder="601 111 111"
              value={h.telefon}
              onChange={zmen("telefon")}
              className={tridy("telefon")}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Devět číslic, předvolbu psát nemusíš.
            </span>
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">E-mail</span>
            <input type="email" name="email" value={h.email} onChange={zmen("email")} className={tridy("email")} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Doklad totožnosti</span>
            <select name="dokladTyp" value={h.dokladTyp} onChange={zmen("dokladTyp")} className={tridy("dokladTyp")}>
              <option>občanský průkaz</option>
              <option>cestovní pas</option>
              <option>povolení k pobytu</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Číslo dokladu</span>
            <input name="dokladCislo" value={h.dokladCislo} onChange={zmen("dokladCislo")} className={tridy("dokladCislo")} />
          </label>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Zákonný zástupce</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Jen u nezletilých. U mladších 15 let musí být jeho podpis na žádosti úředně ověřený.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm text-neutral-500">Jméno a příjmení</span>
            <input
              name="zastupceJmeno"
              value={h.zastupceJmeno}
              onChange={zmen("zastupceJmeno")}
              className={tridy("zastupceJmeno")}
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Vztah k žadateli</span>
            <input
              name="zastupceVztah"
              placeholder="matka, otec…"
              value={h.zastupceVztah}
              onChange={zmen("zastupceVztah")}
              className={tridy("zastupceVztah")}
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-500">Telefon</span>
            <input
              type="tel"
              name="zastupceTelefon"
              value={h.zastupceTelefon}
              onChange={zmen("zastupceTelefon")}
              className={tridy("zastupceTelefon")}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Výcvik</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Spodní část žádosti — tuhle vyplňuje autoškola.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-neutral-500">
              Skupina<span className="text-red-500"> *</span>
            </span>
            <select
              name="skupina"
              required
              value={h.skupina}
              onChange={zmen("skupina")}
              className={tridy("skupina")}
            >
              {SKUPINY.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            {posudek && !posudek.ok ? (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                Na výcvik je ještě brzy — nejdřív {formatDatum(posudek.nejdriv)}.
              </span>
            ) : posudek?.dosazeniVeku &&
              posudek.dosazeniVeku > (h.datumPodaniZadosti || dnesek()) ? (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                Výcvik zahájit může, oprávnění získá až {formatDatum(posudek.dosazeniVeku)}.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Druh</span>
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
              className={tridy("druh")}
            >
              <option value="prvni">první řidičské oprávnění</option>
              <option value="rozsireni">rozšíření</option>
              <option value="bodovy">přezkoušení (bodový)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Datum lékařského posudku</span>
            <input
              type="date"
              name="lekarskyPosudek"
              value={h.lekarskyPosudek}
              onChange={zmen("lekarskyPosudek")}
              className={tridy("lekarskyPosudek")}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Při podání žádosti nesmí být starší tří měsíců (§ 13).
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Datum podání žádosti</span>
            <input
              type="date"
              name="datumPodaniZadosti"
              value={h.datumPodaniZadosti}
              onChange={zmen("datumPodaniZadosti")}
              className={tridy("datumPodaniZadosti")}
            />
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">
              Úřad (ORP) podle bydliště žadatele<span className="text-red-500"> *</span>
            </span>
            <input
              name="orpBydliste"
              required
              value={h.orpBydliste}
              onChange={zmen("orpBydliste")}
              className={tridy("orpBydliste")}
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Nemusí být stejný jako ten, u kterého jsi registrovaný.
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-neutral-500">Učitel</span>
            <select name="ucitelId" value={h.ucitelId} onChange={zmen("ucitelId")} className={tridy("ucitelId")}>
              <option value="">zatím nepřidělen</option>
              {ucitele.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.jmeno} {u.prijmeni}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {h.druh !== "prvni" ? (
        <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <h2 className="font-medium">Stávající řidičské oprávnění</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {h.druh === "rozsireni"
              ? "U rozšíření je potřeba vědět, co už žadatel má — jde to do podání na zkoušky."
              : "U přezkoušení jde skoro vždycky o skupinu B; zkontroluj a případně uprav."}
          </p>

          <div className="mt-4 space-y-4">
            <label className="block sm:max-w-xs">
              <span className="text-sm text-neutral-500">
                Číslo řidičského průkazu<span className="text-red-500"> *</span>
              </span>
              <input
                name="ridicskyPrukazCislo"
                required
                value={h.ridicskyPrukazCislo}
                onChange={zmen("ridicskyPrukazCislo")}
                className={tridy("ridicskyPrukazCislo")}
              />
            </label>

            <fieldset>
              <legend className="text-sm text-neutral-500">
                Skupiny, které už má<span className="text-red-500"> *</span>
              </legend>
              <div
                className={`mt-2 flex flex-wrap gap-2 rounded-lg border p-2 ${
                  jeChybne("stavajiciSkupiny") ? chybny : "border-transparent"
                }`}
              >
                {SKUPINY_V_PRUKAZU.map((s) => {
                  const zaskrtnuta = skupinyZPrukazu.includes(s);
                  return (
                    <label
                      key={s}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
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
              <span className="mt-1 block text-xs text-neutral-500">
                Klikni na skupiny, které má žadatel v průkazu.
              </span>
            </fieldset>
          </div>
        </section>
      ) : null}

      {stav.chyba ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {stav.chyba}
        </p>
      ) : null}

      <div className="flex items-center gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <button
          type="submit"
          disabled={probiha}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {probiha ? "Zakládám…" : "Přijmout žáka"}
        </button>
        <p className="text-sm text-neutral-500">Evidenční číslo přidělí systém sám.</p>
      </div>
    </form>
  );
}
