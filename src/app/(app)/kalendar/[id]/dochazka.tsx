"use client";

import { useActionState, useEffect, useState } from "react";
import { ulozDochazku, type StavDochazky } from "./akce-dochazka";

type Radek = {
  vycvikId: string;
  evidencniCislo: number;
  jmeno: string;
  prijmeni: string;
  pritomen: boolean;
};

export default function Dochazka({
  terminId,
  seznam,
}: {
  terminId: string;
  seznam: Radek[];
}) {
  const [stav, akce, probiha] = useActionState<StavDochazky, FormData>(ulozDochazku, {});

  // Zaškrtnutí drží stav formuláře, ne prohlížeč — po uložení se
  // políčka nesmí vrátit do původní podoby.
  const [pritomni, setPritomni] = useState<Set<string>>(
    () => new Set(seznam.filter((r) => r.pritomen).map((r) => r.vycvikId)),
  );

  useEffect(() => {
    setPritomni(new Set(seznam.filter((r) => r.pritomen).map((r) => r.vycvikId)));
  }, [seznam]);

  function prepni(id: string) {
    setPritomni((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <form action={akce} className="mt-2">
      <input type="hidden" name="terminId" value={terminId} />

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {seznam.map((r) => {
          const je = pritomni.has(r.vycvikId);
          return (
            <li key={r.vycvikId}>
              <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
                <span>
                  <span className="tabular-nums text-neutral-500">{r.evidencniCislo}</span>{" "}
                  {r.jmeno} {r.prijmeni}
                </span>

                <span className="flex items-center gap-2">
                  <span
                    className={
                      je
                        ? "text-sm text-emerald-600 dark:text-emerald-400"
                        : "text-sm text-neutral-400"
                    }
                  >
                    {je ? "byl" : "nebyl"}
                  </span>
                  <input
                    type="checkbox"
                    name="pritomen"
                    value={r.vycvikId}
                    checked={je}
                    onChange={() => prepni(r.vycvikId)}
                    className="size-5"
                  />
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : "Uložit docházku"}
        </button>

        <button
          type="button"
          onClick={() => setPritomni(new Set(seznam.map((r) => r.vycvikId)))}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Všichni byli
        </button>

        {stav.hotovo && !probiha ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Uloženo.</span>
        ) : null}
        {stav.chyba ? (
          <span className="text-sm text-red-600 dark:text-red-400">{stav.chyba}</span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Uložením se termín označí jako proběhlý. Změny docházky se zapisují do
        historie.
      </p>
    </form>
  );
}
