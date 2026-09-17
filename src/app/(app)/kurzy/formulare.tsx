"use client";

import { useActionState, useState } from "react";
import { ulozSlozeniKurzu, zalozKurz, type StavKurzu } from "./akce";

type Kurz = {
  id: string;
  nazev: string;
  skupina: string;
  datumZahajeni: string | null;
  poznamka: string | null;
};

type Zak = {
  id: string;
  evidencniCislo: number;
  jmeno: string;
  prijmeni: string;
  skupina: string;
  kurzId: string | null;
};

const vstup =
  "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

function Slozeni({ kurz, zaci }: { kurz: Kurz; zaci: Zak[] }) {
  const [stav, akce, probiha] = useActionState<StavKurzu, FormData>(ulozSlozeniKurzu, {});
  const [otevreno, setOtevreno] = useState(false);

  const vKurzu = zaci.filter((z) => z.kurzId === kurz.id);

  return (
    <div className="mt-2">
      <p className="text-sm text-neutral-500">
        {vKurzu.length === 0
          ? "zatím bez žáků"
          : vKurzu.map((z) => `${z.jmeno} ${z.prijmeni}`).join(", ")}
      </p>

      {!otevreno ? (
        <button
          onClick={() => setOtevreno(true)}
          className="mt-1 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Upravit složení
        </button>
      ) : (
        <form action={akce} className="mt-2">
          <input type="hidden" name="kurzId" value={kurz.id} />

          <div className="flex flex-wrap gap-1.5">
            {zaci.map((z) => {
              const vTomhle = z.kurzId === kurz.id;
              const jinde = z.kurzId !== null && !vTomhle;
              return (
                <label
                  key={z.id}
                  title={jinde ? "Žák je zatím v jiném kurzu — zaškrtnutím ho přesuneš sem." : ""}
                  className="cursor-pointer rounded-md border border-neutral-300 px-2 py-1 text-xs has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white dark:border-neutral-700 dark:has-checked:border-white dark:has-checked:bg-white dark:has-checked:text-neutral-900"
                >
                  <input
                    type="checkbox"
                    name="vycvikId"
                    value={z.id}
                    defaultChecked={vTomhle}
                    className="sr-only"
                  />
                  {z.evidencniCislo} · {z.prijmeni} ({z.skupina})
                  {jinde ? " ⟂" : ""}
                </label>
              );
            })}
          </div>

          {stav.chyba ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
          ) : null}

          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={probiha} className="tlacitko">
              {probiha ? "Ukládám…" : "Uložit složení"}
            </button>
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              className="text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Zavřít
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function KurzFormulare({ kurzy, zaci }: { kurzy: Kurz[]; zaci: Zak[] }) {
  const [stav, akce, probiha] = useActionState<StavKurzu, FormData>(zalozKurz, {});
  const [otevreno, setOtevreno] = useState(false);

  return (
    <div className="space-y-4">
      {!otevreno ? (
        <button onClick={() => setOtevreno(true)} className="tlacitko">
          Nový kurz
        </button>
      ) : (
        <form
          action={akce}
          className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
            <label className="block sm:col-span-2">
              <span className="text-xs text-neutral-500">Název</span>
              <input name="nazev" required placeholder="Září 2026" className={vstup} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs text-neutral-500">Skupina</span>
              <input name="skupina" defaultValue="B" className={vstup} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs text-neutral-500">Zahájení</span>
              <input type="date" name="datumZahajeni" className={vstup} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-neutral-500">Poznámka</span>
              <input name="poznamka" className={vstup} />
            </label>
          </div>

          {stav.chyba ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={probiha} className="tlacitko">
              {probiha ? "Zakládám…" : "Založit"}
            </button>
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              className="text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Zavřít
            </button>
          </div>
        </form>
      )}

      {kurzy.length === 0 ? (
        <p className="text-sm text-neutral-500">Zatím tu není žádný kurz.</p>
      ) : (
        <ul className="space-y-3">
          {kurzy.map((k) => (
            <li
              key={k.id}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-medium">{k.nazev}</p>
                <p className="text-sm text-neutral-500">
                  skupina {k.skupina}
                  {k.datumZahajeni ? ` · od ${k.datumZahajeni}` : ""}
                </p>
              </div>
              {k.poznamka ? (
                <p className="mt-1 text-sm text-neutral-500">{k.poznamka}</p>
              ) : null}
              <Slozeni kurz={k} zaci={zaci} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
