"use client";

import { useState } from "react";

/**
 * Kopírování do schránky.
 *
 * Pravidlo pro celou aplikaci: kdekoli je něco, co má člověk přenést
 * jinam — odkaz, adresa kalendáře, heslo — patří k tomu tlačítko.
 * Označovat dlouhý odkaz myší je na telefonu skoro nemožné a na počítači
 * otrava.
 *
 * Dvě podoby: ikonka vedle řádku s hodnotou (výchozí, nezabírá místo)
 * a textové tlačítko tam, kde ikonka nemá o co se opřít.
 *
 * Když prohlížeč schránku nepustí (starší Safari, stránka bez https),
 * nic se nerozbije: hodnota je vidět a dá se označit ručně. Proto se
 * nezdar hlásí, ne tiše polyká.
 */
export default function Kopirovat({
  text,
  podoba = "ikona",
  popis = "Kopírovat",
}: {
  text: string;
  podoba?: "ikona" | "text";
  popis?: string;
}) {
  const [stav, setStav] = useState<"klid" | "hotovo" | "nejde">("klid");

  async function zkopiruj() {
    try {
      await navigator.clipboard.writeText(text);
      setStav("hotovo");
    } catch {
      setStav("nejde");
    }
    setTimeout(() => setStav("klid"), 2500);
  }

  if (podoba === "text") {
    return (
      <button
        type="button"
        onClick={zkopiruj}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        {stav === "hotovo"
          ? "Zkopírováno"
          : stav === "nejde"
            ? "Nejde — označ ručně"
            : popis}
      </button>
    );
  }

  const nazev =
    stav === "hotovo"
      ? "Zkopírováno"
      : stav === "nejde"
        ? "Schránka nejde — označ ručně"
        : popis;

  return (
    <button
      type="button"
      onClick={zkopiruj}
      title={nazev}
      aria-label={nazev}
      className={`shrink-0 rounded-md border p-2 ${
        stav === "hotovo"
          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
          : stav === "nejde"
            ? "border-red-500 text-red-600 dark:text-red-400"
            : "border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      }`}
    >
      {stav === "hotovo" ? (
        // fajfka
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        // dva přeložené listy papíru
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
