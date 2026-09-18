"use client";

import { useActionState, useEffect, useState } from "react";
import { ulozPoznamku, type StavPoznamky } from "./akce";

/**
 * Poznámka u žáka v třídní knize.
 *
 * Text je vidět vždycky a tiskne se s knihou; ovládání na úpravu se
 * netiskne. Prázdná poznámka se uložením smaže.
 */
export default function Poznamka({
  kurzId,
  vycvikId,
  puvodni,
}: {
  kurzId: string;
  vycvikId: string;
  puvodni: string;
}) {
  const [stav, akce, probiha] = useActionState<StavPoznamky, FormData>(
    ulozPoznamku,
    {},
  );

  const [upravuji, setUpravuji] = useState(false);
  const [text, setText] = useState(puvodni);

  // Když se stránka překreslí s novou hodnotou ze serveru, drž se jí.
  useEffect(() => {
    setText(puvodni);
  }, [puvodni]);

  useEffect(() => {
    if (stav.hotovo) setUpravuji(false);
  }, [stav]);

  if (!upravuji) {
    return (
      <div>
        {puvodni ? (
          <p className="whitespace-pre-line">{puvodni}</p>
        ) : (
          <p className="text-neutral-400">—</p>
        )}
        <button
          type="button"
          onClick={() => setUpravuji(true)}
          className="netisknout mt-0.5 text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          {puvodni ? "Upravit poznámku" : "Přidat poznámku"}
        </button>
      </div>
    );
  }

  return (
    <form action={akce} className="netisknout">
      <input type="hidden" name="kurzId" value={kurzId} />
      <input type="hidden" name="vycvikId" value={vycvikId} />

      <textarea
        name="poznamka"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="nemoc, přerušeno, dohodnutá náhrada…"
        className="w-full min-w-48 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />

      {stav.chyba ? (
        <p className="text-xs text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <div className="mt-1 flex items-center gap-3 text-xs">
        <button type="submit" disabled={probiha} className="tlacitko-vedlejsi">
          {probiha ? "Ukládám…" : "Uložit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setText(puvodni);
            setUpravuji(false);
          }}
          className="text-neutral-500 underline-offset-4 hover:underline"
        >
          Zpět
        </button>
      </div>
    </form>
  );
}
