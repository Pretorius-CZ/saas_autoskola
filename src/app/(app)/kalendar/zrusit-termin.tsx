"use client";

import { useState, useTransition } from "react";
import { zrusTermin } from "./akce-terminy";

export default function ZrusitTermin({ id }: { id: string }) {
  const [ptamSe, setPtamSe] = useState(false);
  const [probiha, zacni] = useTransition();

  if (!ptamSe) {
    return (
      <button
        onClick={() => setPtamSe(true)}
        className="rounded border border-red-500/50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
      >
        zrušit
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        onClick={() => zacni(() => zrusTermin(id))}
        disabled={probiha}
        className="font-medium text-red-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-red-400"
      >
        {probiha ? "ruším…" : "opravdu zrušit"}
      </button>
      <button onClick={() => setPtamSe(false)} className="text-neutral-400 underline-offset-4 hover:underline">
        ne
      </button>
    </span>
  );
}
