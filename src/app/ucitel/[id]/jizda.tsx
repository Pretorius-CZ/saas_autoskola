"use client";

import { useActionState, useState } from "react";
import { ukonciJizdu, zahajJizdu, type StavKroku } from "./akce";

/**
 * Zahájení a ukončení jízdy se stavem tachometru.
 *
 * Políčko na kilometry je číselné a na telefonu vyvolá číselnou
 * klávesnici (inputMode). Předvyplní se posledním známým stavem toho
 * vozidla — ať se neopisuje šest číslic z tachometru, když se od minule
 * nic nezměnilo. Je to nabídka, ne omezení: přepsat ho jde vždycky.
 */
export default function KrokJizdy({
  terminId,
  krok,
  nabidka,
}: {
  terminId: string;
  krok: "zahajit" | "ukoncit";
  /** Co nabídnout v políčku. U zahájení poslední stav vozidla. */
  nabidka: number | null;
}) {
  const [stav, akce, probiha] = useActionState<StavKroku, FormData>(
    krok === "zahajit" ? zahajJizdu : ukonciJizdu,
    {},
  );

  const [km, setKm] = useState(nabidka === null ? "" : String(nabidka));

  return (
    <form action={akce}>
      <input type="hidden" name="terminId" value={terminId} />

      <label className="block">
        <span className="text-sm">
          {krok === "zahajit"
            ? "Stav tachometru před vyjetím"
            : "Stav tachometru po návratu"}
        </span>
        <input
          name="km"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="km"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-lg tabular-nums outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {nabidka !== null && krok === "zahajit" ? (
        <p className="mt-1 text-xs text-neutral-500">
          Poslední zapsaný stav u tohohle vozidla byl{" "}
          <span className="tabular-nums">{nabidka}</span> km.
        </p>
      ) : null}

      {stav.chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <button type="submit" disabled={probiha} className="tlacitko mt-3 w-full">
        {probiha
          ? "Ukládám…"
          : krok === "zahajit"
            ? "Zahájit jízdu"
            : "Ukončit jízdu"}
      </button>
    </form>
  );
}
