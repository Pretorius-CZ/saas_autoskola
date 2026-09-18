"use client";

import { useActionState, useEffect, useState } from "react";
import { upravUcitele, zalozUcitele, type StavUcitele } from "./akce";
import PrihlaseniUcitele from "./prihlaseni-ucitele";
import { dniDo, formatDatum } from "@/lib/datum";

export type Ucitel = {
  id: string;
  jmeno: string;
  prijmeni: string;
  email: string | null;
  telefon: string | null;
  cisloOsvedceni: string | null;
  osvedceniPlatnostDo: string | null;
  zdravotniZpusobilostDo: string | null;
  skupiny: string | null;
  bankovniUcet: string | null;
  poznamka: string | null;
  aktivni: boolean;
  maUcet: boolean;
  uctovyEmail: string | null;
};

type Hodnoty = Record<string, string>;

const vstup =
  "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Šířky se vypisují celé, ne skládají z proměnné.
 *
 * Tailwind hledá názvy tříd v textu souboru. Kdyby tu stálo
 * `sm:col-span-${sirka}`, žádnou z nich by nenašel a mřížka by se
 * rozsypala — bez jediné chybové hlášky.
 */
const sloupce: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  6: "sm:col-span-6",
};

/**
 * Políčko je schválně tady, mimo formulář.
 *
 * Kdyby bylo uvnitř, React by ho při každém napsaném písmenu považoval
 * za nový prvek, zahodil ten starý a s ním i kurzor. Tahle chyba nás
 * stála večer u žáků, tak ať se neopakuje.
 */
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

function prazdny(): Hodnoty {
  return {
    jmeno: "",
    prijmeni: "",
    email: "",
    telefon: "",
    cisloOsvedceni: "",
    osvedceniPlatnostDo: "",
    zdravotniZpusobilostDo: "",
    skupiny: "",
    bankovniUcet: "",
    poznamka: "",
  };
}

function zUcitele(u: Ucitel): Hodnoty {
  return {
    jmeno: u.jmeno,
    prijmeni: u.prijmeni,
    email: u.email ?? "",
    telefon: u.telefon ?? "",
    cisloOsvedceni: u.cisloOsvedceni ?? "",
    osvedceniPlatnostDo: u.osvedceniPlatnostDo ?? "",
    zdravotniZpusobilostDo: u.zdravotniZpusobilostDo ?? "",
    skupiny: u.skupiny ?? "",
    bankovniUcet: u.bankovniUcet ?? "",
    poznamka: u.poznamka ?? "",
  };
}

function Formular({
  ucitel,
  zavri,
}: {
  ucitel: Ucitel | null;
  zavri: () => void;
}) {
  const [stav, akce, probiha] = useActionState<StavUcitele, FormData>(
    ucitel ? upravUcitele : zalozUcitele,
    {},
  );

  // Hodnoty drží formulář sám: React je po odeslání vyprazdňuje a při
  // chybě by se všechno psalo znovu.
  const [h, setH] = useState<Hodnoty>(() => (ucitel ? zUcitele(ucitel) : prazdny()));
  const [aktivni, setAktivni] = useState(ucitel ? ucitel.aktivni : true);

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
      {ucitel ? <input type="hidden" name="id" value={ucitel.id} /> : null}

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        {p("jmeno", "Jméno")}
        {p("prijmeni", "Příjmení")}
        {p("skupiny", "Smí učit skupiny")}

        {p("email", "E-mail", 3)}
        {p("telefon", "Telefon", 3)}

        {p("cisloOsvedceni", "Číslo osvědčení")}
        {p("osvedceniPlatnostDo", "Osvědčení platí do", 2, "date")}
        {p("zdravotniZpusobilostDo", "Zdravotní způsobilost do", 2, "date")}

        {p("bankovniUcet", "Bankovní účet", 3)}
        {p("poznamka", "Poznámka", 3)}

        {ucitel ? (
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="aktivni"
              value="ano"
              checked={aktivni}
              onChange={(e) => setAktivni(e.target.checked)}
            />
            <span>Učí (neaktivní se nenabízí při plánování)</span>
          </label>
        ) : null}
      </div>

      {stav.chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : ucitel ? "Uložit změny" : "Přidat učitele"}
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

function Platnost({ datum }: { datum: string | null }) {
  const dni = dniDo(datum);

  if (dni === null) return <span className="text-neutral-400">nevyplněno</span>;
  if (dni < 0) {
    return (
      <span className="font-medium text-red-600 dark:text-red-400">
        {formatDatum(datum)} · propadlo
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

export default function SpravaUcitelu({ seznam }: { seznam: Ucitel[] }) {
  const [novy, setNovy] = useState(false);
  const [upravovany, setUpravovany] = useState<string | null>(null);

  return (
    <>
      <div className="mt-4">
        {novy ? (
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm font-medium">Nový učitel</p>
            <Formular ucitel={null} zavri={() => setNovy(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setNovy(true)} className="tlacitko">
            Přidat učitele
          </button>
        )}
      </div>

      {seznam.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Zatím tu není nikdo.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {seznam.map((u) => (
            <li
              key={u.id}
              /* Barva rámečku říká, jestli učitel učí — poznat se to má
                 z přehledu, ne až po rozkliknutí. */
              className={`rounded-xl border p-4 ${
                u.aktivni
                  ? "border-emerald-500/60"
                  : "border-red-500/60 bg-red-500/5"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-medium">
                  {u.jmeno} {u.prijmeni}
                  {u.aktivni ? null : (
                    <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                      neučí
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-500">{u.skupiny ?? "—"}</p>
              </div>

              {upravovany === u.id ? (
                <Formular ucitel={u} zavri={() => setUpravovany(null)} />
              ) : (
                <>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-neutral-500">Osvědčení</dt>
                      <dd>
                        {u.cisloOsvedceni ?? "—"}{" "}
                        <span className="text-neutral-400">·</span>{" "}
                        <Platnost datum={u.osvedceniPlatnostDo} />
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-neutral-500">Zdravotní způsobilost</dt>
                      <dd>
                        <Platnost datum={u.zdravotniZpusobilostDo} />
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-neutral-500">Kontakt</dt>
                      <dd>
                        {u.telefon ?? "—"}
                        {u.email ? (
                          <>
                            {" "}
                            <span className="text-neutral-400">·</span> {u.email}
                          </>
                        ) : null}
                      </dd>
                    </div>

                    <div className="flex justify-between gap-4 sm:block">
                      <dt className="text-neutral-500">Účet</dt>
                      <dd className="tabular-nums">{u.bankovniUcet ?? "—"}</dd>
                    </div>
                  </dl>

                  {u.poznamka ? (
                    <p className="mt-3 text-sm text-neutral-500">{u.poznamka}</p>
                  ) : null}

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setUpravovany(u.id)}
                      className="tlacitko-vedlejsi"
                    >
                      Upravit
                    </button>
                  </div>

                  <PrihlaseniUcitele
                    ucitelId={u.id}
                    email={u.email}
                    maUcet={u.maUcet}
                    uctovyEmail={u.uctovyEmail}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
