"use client";

import { useActionState, useEffect, useState } from "react";
import { upravVozidlo, zalozVozidlo, type StavVozidla } from "./akce";
import { dniDo, formatDatum } from "@/lib/datum";

export type Vozidlo = {
  id: string;
  znacka: string;
  typ: string;
  rz: string;
  skupina: string;
  stkDo: string | null;
  poznamka: string | null;
  aktivni: boolean;
};

type Hodnoty = Record<string, string>;

const vstup =
  "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

/** Šířky celé, ne z proměnné — Tailwind hledá názvy tříd v textu souboru. */
const sloupce: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
};

/** Políčko patří mimo formulář, jinak React při psaní ztrácí kurzor. */
function Pole({
  klic,
  popis,
  hodnota,
  zmen,
  chybne,
  typ = "text",
  sirka = 2,
}: {
  klic: string;
  popis: string;
  hodnota: string;
  zmen: (klic: string, hodnota: string) => void;
  chybne: boolean;
  typ?: string;
  sirka?: number;
}) {
  return (
    <label className={`block ${sloupce[sirka]}`}>
      <span className="text-xs text-neutral-500">{popis}</span>
      <input
        type={typ}
        name={klic}
        value={hodnota}
        onChange={(e) => zmen(klic, e.target.value)}
        className={`${vstup} ${chybne ? "pole-chyba" : ""}`}
      />
    </label>
  );
}

function prazdne(): Hodnoty {
  return { znacka: "", typ: "", rz: "", skupina: "B", stkDo: "", poznamka: "" };
}

function zVozidla(v: Vozidlo): Hodnoty {
  return {
    znacka: v.znacka,
    typ: v.typ,
    rz: v.rz,
    skupina: v.skupina,
    stkDo: v.stkDo ?? "",
    poznamka: v.poznamka ?? "",
  };
}

function Formular({ vozidlo, zavri }: { vozidlo: Vozidlo | null; zavri: () => void }) {
  const [stav, akce, probiha] = useActionState<StavVozidla, FormData>(
    vozidlo ? upravVozidlo : zalozVozidlo,
    {},
  );

  const [h, setH] = useState<Hodnoty>(() =>
    vozidlo ? zVozidla(vozidlo) : prazdne(),
  );
  const [aktivni, setAktivni] = useState(vozidlo ? vozidlo.aktivni : true);

  useEffect(() => {
    if (stav.hodnoty) {
      setH((p) => {
        const n = { ...p };
        for (const klic of Object.keys(p)) {
          const v = stav.hodnoty![klic];
          if (typeof v === "string") n[klic] = v;
        }
        return n;
      });
    }
    if (stav.hotovo) zavri();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav]);

  const zmen = (klic: string, hodnota: string) =>
    setH((p) => ({ ...p, [klic]: hodnota }));

  const p = (klic: string, popis: string, sirka = 2, typ = "text") => (
    <Pole
      klic={klic}
      popis={popis}
      hodnota={h[klic] ?? ""}
      zmen={zmen}
      chybne={stav.pole === klic}
      sirka={sirka}
      typ={typ}
    />
  );

  return (
    <form action={akce} className="mt-2">
      {vozidlo ? <input type="hidden" name="id" value={vozidlo.id} /> : null}

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        {p("znacka", "Značka")}
        {p("typ", "Typ")}
        {p("rz", "Registrační značka")}

        {p("skupina", "Skupina", 1)}
        {p("stkDo", "STK do", 2, "date")}
        {p("poznamka", "Poznámka", 3)}

        {vozidlo ? (
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktivni"
              value="ano"
              checked={aktivni}
              onChange={(e) => setAktivni(e.target.checked)}
            />
            <span>Jezdí (neaktivní se nenabízí při plánování)</span>
          </label>
        ) : null}
      </div>

      {stav.chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : vozidlo ? "Uložit změny" : "Přidat vozidlo"}
        </button>
        <button
          type="button"
          onClick={zavri}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Zpět bez uložení
        </button>
      </div>
    </form>
  );
}

function Stk({ datum }: { datum: string | null }) {
  const dni = dniDo(datum);

  if (dni === null) return <span className="text-neutral-400">nevyplněno</span>;
  if (dni < 0) {
    return (
      <span className="font-medium text-red-600 dark:text-red-400">
        propadla {formatDatum(datum)}
      </span>
    );
  }
  if (dni <= 60) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        {formatDatum(datum)} · za {dni} dní
      </span>
    );
  }
  return <span>{formatDatum(datum)}</span>;
}

export default function SpravaVozidel({ seznam }: { seznam: Vozidlo[] }) {
  const [nove, setNove] = useState(false);
  const [upravovane, setUpravovane] = useState<string | null>(null);

  return (
    <>
      <div className="mt-4">
        {nove ? (
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm font-medium">Nové vozidlo</p>
            <Formular vozidlo={null} zavri={() => setNove(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setNove(true)} className="tlacitko">
            Přidat vozidlo
          </button>
        )}
      </div>

      {seznam.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Zatím tu není nic.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {seznam.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="font-medium">
                    {v.znacka} {v.typ}
                    {v.aktivni ? null : (
                      <span className="ml-2 text-sm font-normal text-neutral-500">
                        neaktivní
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-neutral-500">
                    <span className="tabular-nums">{v.rz}</span> · skupina {v.skupina}
                  </p>
                </div>

                <p className="text-sm">
                  <span className="text-neutral-500">STK </span>
                  <Stk datum={v.stkDo} />
                </p>
              </div>

              {upravovane === v.id ? (
                <Formular vozidlo={v} zavri={() => setUpravovane(null)} />
              ) : (
                <>
                  {v.poznamka ? (
                    <p className="mt-2 text-sm text-neutral-500">{v.poznamka}</p>
                  ) : null}

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setUpravovane(v.id)}
                      className="tlacitko-vedlejsi"
                    >
                      Upravit
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
