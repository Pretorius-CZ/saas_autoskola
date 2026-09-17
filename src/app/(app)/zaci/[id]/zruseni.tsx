"use client";

import { useState, useTransition } from "react";
import { zmenZruseni } from "./upravit/akce";

/**
 * Zrušení výcviku, ne smazání.
 *
 * Evidenční kniha má být nepřetržitá řada — chybějící číslo v ní vypadá
 * jako ztracený záznam. Zrušený výcvik proto zůstává, jen je označený.
 */
export default function Zruseni({ id, zruseno }: { id: string; zruseno: boolean }) {
  const [ptamSe, setPtamSe] = useState(false);
  const [probiha, zacni] = useTransition();

  if (zruseno) {
    return (
      <button
        onClick={() => zacni(() => zmenZruseni(id, false))}
        disabled={probiha}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50"
      >
        {probiha ? "Obnovuji…" : "Obnovit výcvik"}
      </button>
    );
  }

  if (!ptamSe) {
    return (
      <button
        onClick={() => setPtamSe(true)}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        Zrušit výcvik
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-3 text-sm">
      <span className="text-neutral-500">Opravdu zrušit? Záznam v evidenci zůstane.</span>
      <button
        onClick={() => zacni(() => zmenZruseni(id, true))}
        disabled={probiha}
        className="rounded-md bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-50"
      >
        {probiha ? "Ruším…" : "Zrušit"}
      </button>
      <button onClick={() => setPtamSe(false)} className="text-neutral-500 underline-offset-4 hover:underline">
        Ne
      </button>
    </span>
  );
}
