"use client";

import { useActionState, useEffect, useState } from "react";
import { CASY, DELKY } from "@/lib/cas";
import { ulozTermin, type StavTerminu } from "./akce-terminy";

type Ucitel = { id: string; jmeno: string; prijmeni: string };
type Vozidlo = { id: string; znacka: string; typ: string; rz: string };
type Kurz = { id: string; nazev: string; skupina: string };
type Zak = {
  id: string;
  evidencniCislo: number;
  jmeno: string;
  prijmeni: string;
  skupina: string;
};

const zaklad =
  "mt-0.5 w-full rounded-md border bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-neutral-900";
const bezny = "border-neutral-300 focus:border-neutral-500 dark:border-neutral-700";
const chybny = "border-red-500 focus:border-red-600 dark:border-red-500";

type Hodnoty = Record<string, string>;

export default function NovyTermin({
  ucitele,
  vozidla,
  kurzy,
  zaci,
  vychoziDatum,
}: {
  ucitele: Ucitel[];
  vozidla: Vozidlo[];
  kurzy: Kurz[];
  zaci: Zak[];
  vychoziDatum: string;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [stav, akce, probiha] = useActionState<StavTerminu, FormData>(ulozTermin, {});

  /**
   * Formulář si drží hodnoty sám.
   *
   * React po odeslání políčka vyprázdní a rozbalovací seznamy vrátí na
   * výchozí hodnotu. U formuláře žáka jsem to už jednou řešil a tady na to
   * znovu zapomněl — proto to tu takhle stojí i s poznámkou.
   */
  const vychozi = (): Hodnoty => ({
    druh: "jizda",
    datum: vychoziDatum,
    cas: "08:00",
    delkaMinut: "90",
    ucitelId: "",
    vozidloId: "",
    kurzId: "",
    vycvikId: "",
    tema: "",
    misto: "",
  });

  const [h, setH] = useState<Hodnoty>(vychozi);

  const zmen = (klic: string) => (e: { target: { value: string } }) =>
    setH((p) => ({ ...p, [klic]: e.target.value }));

  useEffect(() => {
    if (stav.hodnoty) setH((p) => ({ ...p, ...stav.hodnoty }));
    // po úspěchu začni s čistým stolem, ale nech vybrané datum
    if (stav.hotovo) setH((p) => ({ ...vychozi(), datum: p.datum, cas: p.cas }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav]);

  useEffect(() => {
    if (!stav.pole) return;
    const prvek = document.querySelector<HTMLElement>(`[name="${stav.pole}"]`);
    prvek?.focus();
  }, [stav]);

  const tridy = (klic: string) => `${zaklad} ${stav.pole === klic ? chybny : bezny}`;

  if (!otevreno) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => setOtevreno(true)} className="tlacitko">
          Naplánovat termín
        </button>
        {stav.hotovo ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Uloženo.</span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={akce}
      className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <label className="block sm:col-span-1">
          <span className="text-xs text-neutral-500">Druh</span>
          <select name="druh" value={h.druh} onChange={zmen("druh")} className={tridy("druh")}>
            <option value="jizda">jízda</option>
            <option value="teorie">teorie</option>
            <option value="udrzba">údržba</option>
            <option value="zdravotni">zdravotní příprava</option>
          </select>
        </label>

        <label className="block sm:col-span-1">
          <span className="text-xs text-neutral-500">Datum</span>
          <input
            type="date"
            name="datum"
            required
            value={h.datum}
            onChange={zmen("datum")}
            className={tridy("datum")}
          />
        </label>

        <label className="block sm:col-span-1">
          <span className="text-xs text-neutral-500">Začátek</span>
          <select name="cas" value={h.cas} onChange={zmen("cas")} className={tridy("cas")}>
            {CASY.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-1">
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

        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Učitel</span>
          <select
            name="ucitelId"
            value={h.ucitelId}
            onChange={zmen("ucitelId")}
            className={tridy("ucitelId")}
          >
            <option value="">nikdo</option>
            {ucitele.map((u) => (
              <option key={u.id} value={u.id}>
                {u.jmeno} {u.prijmeni}
              </option>
            ))}
          </select>
        </label>

        {h.druh === "teorie" ? (
          <label className="block sm:col-span-3">
            <span className="text-xs text-neutral-500">Kurz</span>
            <select
              name="kurzId"
              value={h.kurzId}
              onChange={zmen("kurzId")}
              className={tridy("kurzId")}
            >
              <option value="">vyber kurz</option>
              {kurzy.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazev} ({k.skupina})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="block sm:col-span-3">
              <span className="text-xs text-neutral-500">Žák</span>
              <select
                name="vycvikId"
                value={h.vycvikId}
                onChange={zmen("vycvikId")}
                className={tridy("vycvikId")}
              >
                <option value="">vyber žáka</option>
                {zaci.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.evidencniCislo} · {z.jmeno} {z.prijmeni} ({z.skupina})
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-3">
              <span className="text-xs text-neutral-500">Vozidlo</span>
              <select
                name="vozidloId"
                value={h.vozidloId}
                onChange={zmen("vozidloId")}
                className={tridy("vozidloId")}
              >
                <option value="">žádné</option>
                {vozidla.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.znacka} {v.typ} · {v.rz}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="block sm:col-span-3">
          <span className="text-xs text-neutral-500">Téma / poznámka</span>
          <input name="tema" value={h.tema} onChange={zmen("tema")} className={tridy("tema")} />
        </label>

        <label className="block sm:col-span-3">
          <span className="text-xs text-neutral-500">Místo srazu</span>
          <input name="misto" value={h.misto} onChange={zmen("misto")} className={tridy("misto")} />
        </label>
      </div>

      {stav.chyba ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {stav.chyba}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : "Naplánovat"}
        </button>
        <button
          type="button"
          onClick={() => setOtevreno(false)}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Zavřít
        </button>
        {stav.hotovo && !probiha ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Uloženo, můžeš plánovat další.
          </span>
        ) : null}
      </div>
    </form>
  );
}
