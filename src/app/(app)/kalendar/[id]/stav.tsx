"use client";

import { useTransition } from "react";
import { nastavStavTerminu } from "./akce-dochazka";

const POPIS: Record<string, string> = {
  planovano: "naplánováno",
  probehlo: "proběhlo",
  zruseno: "zrušeno",
};

export default function StavTerminu({ id, stav }: { id: string; stav: string }) {
  const [probiha, zacni] = useTransition();

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">{POPIS[stav] ?? stav}</span>

      {stav !== "probehlo" ? (
        <button
          onClick={() => zacni(() => nastavStavTerminu(id, "probehlo"))}
          disabled={probiha}
          className="text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50"
        >
          označit jako proběhlé
        </button>
      ) : (
        <button
          onClick={() => zacni(() => nastavStavTerminu(id, "planovano"))}
          disabled={probiha}
          className="text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50"
        >
          vrátit na naplánované
        </button>
      )}
    </span>
  );
}
