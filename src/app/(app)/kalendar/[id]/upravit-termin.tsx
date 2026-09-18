"use client";

import { useActionState, useEffect, useState } from "react";
import { CASY, DELKY } from "@/lib/cas";
import { PREDMETY } from "@/lib/osnova";
import { upravTermin, type StavTerminu } from "../akce-terminy";

type Ucitel = { id: string; jmeno: string; prijmeni: string };
type Vozidlo = { id: string; znacka: string; typ: string; rz: string };
type Hodnoty = Record<string, string>;

const zaklad =
  "mt-0.5 w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-neutral-900";
const bezny = "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700";
const chybny = "pole-chyba";

/**
 * Úprava naplánovaného termínu.
 *
 * Mění se čas, délka, učitel, vozidlo a popis. Druh, žák a kurz tu
 * schválně nejsou — na nich visí docházka a podpisy, takže přehodit je
 * není úprava, ale jiný termín.
 *
 * Formulář si drží hodnoty sám: React je po odeslání vyprazdňuje a při
 * chybě by se všechno vybíralo znovu.
 */
export default function UpravitTermin({
  termin,
  ucitele,
  vozidla,
  skupinaKurzu,
}: {
  termin: {
    id: string;
    druh: string;
    datum: string;
    cas: string;
    delkaMinut: number;
    ucitelId: string | null;
    vozidloId: string | null;
    predmet: string | null;
    tema: string | null;
    misto: string | null;
    poznamka: string | null;
  };
  ucitele: Ucitel[];
  vozidla: Vozidlo[];
  skupinaKurzu: string;
}) {
  const [stav, akce, probiha] = useActionState<StavTerminu, FormData>(upravTermin, {});
  const [otevreno, setOtevreno] = useState(false);

  const [h, setH] = useState<Hodnoty>({
    datum: termin.datum,
    cas: termin.cas,
    delkaMinut: String(termin.delkaMinut),
    ucitelId: termin.ucitelId ?? "",
    vozidloId: termin.vozidloId ?? "",
    predmet: termin.predmet ?? "",
    tema: termin.tema ?? "",
    misto: termin.misto ?? "",
    poznamka: termin.poznamka ?? "",
  });

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
    if (stav.hotovo) setOtevreno(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav]);

  const zmen = (klic: string) => (e: { target: { value: string } }) =>
    setH((p) => ({ ...p, [klic]: e.target.value }));

  const tridy = (klic: string) =>
    `${zaklad} ${stav.pole === klic ? chybny : bezny}`;

  if (!otevreno) {
    return (
      <button
        type="button"
        onClick={() => setOtevreno(true)}
        className="tlacitko-vedlejsi"
      >
        Upravit termín
      </button>
    );
  }

  const predmety = PREDMETY[skupinaKurzu] ?? [];

  return (
    <form
      action={akce}
      className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <input type="hidden" name="id" value={termin.id} />

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Datum</span>
          <input
            type="date"
            name="datum"
            value={h.datum}
            onChange={zmen("datum")}
            className={tridy("datum")}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Začátek</span>
          <select
            name="cas"
            value={h.cas}
            onChange={zmen("cas")}
            className={tridy("cas")}
          >
            {/* Kdyby měl termín čas mimo nabídku (naplánovaný dřív,
                jiným způsobem), ať z výběru nevypadne. */}
            {(CASY.includes(h.cas) ? CASY : [h.cas, ...CASY]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Délka</span>
          <select
            name="delkaMinut"
            value={h.delkaMinut}
            onChange={zmen("delkaMinut")}
            className={tridy("delkaMinut")}
          >
            {DELKY.map((d) => (
              <option key={d.minut} value={d.minut}>
                {d.popis}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-3">
          <span className="text-xs text-neutral-500">Učitel</span>
          <select
            name="ucitelId"
            value={h.ucitelId}
            onChange={zmen("ucitelId")}
            className={tridy("ucitelId")}
          >
            <option value="">—</option>
            {ucitele.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prijmeni} {u.jmeno}
              </option>
            ))}
          </select>
        </label>

        {termin.druh === "jizda" ? (
          <label className="block sm:col-span-3">
            <span className="text-xs text-neutral-500">Vozidlo</span>
            <select
              name="vozidloId"
              value={h.vozidloId}
              onChange={zmen("vozidloId")}
              className={tridy("vozidloId")}
            >
              <option value="">—</option>
              {vozidla.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.znacka} {v.typ} · {v.rz}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {termin.druh === "teorie" ? (
          <label className="block sm:col-span-3">
            <span className="text-xs text-neutral-500">Předmět osnovy</span>
            <select
              name="predmet"
              value={h.predmet}
              onChange={zmen("predmet")}
              className={tridy("predmet")}
            >
              <option value="">—</option>
              {predmety.map((p) => (
                <option key={p.klic} value={p.klic}>
                  {p.nazev}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block sm:col-span-3">
          <span className="text-xs text-neutral-500">Místo srazu</span>
          <input
            name="misto"
            value={h.misto}
            onChange={zmen("misto")}
            className={tridy("misto")}
          />
        </label>

        <label className="block sm:col-span-3">
          <span className="text-xs text-neutral-500">Téma</span>
          <input
            name="tema"
            value={h.tema}
            onChange={zmen("tema")}
            className={tridy("tema")}
          />
        </label>

        <label className="block sm:col-span-6">
          <span className="text-xs text-neutral-500">Poznámka</span>
          <input
            name="poznamka"
            value={h.poznamka}
            onChange={zmen("poznamka")}
            className={tridy("poznamka")}
          />
        </label>
      </div>

      {stav.chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : "Uložit změny"}
        </button>
        <button
          type="button"
          onClick={() => setOtevreno(false)}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Zpět bez uložení
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Žák, kurz ani druh termínu se tu nemění — visí na nich docházka
        a podpisy. Když je potřeba změnit je, zruš termín a naplánuj nový.
      </p>
    </form>
  );
}
