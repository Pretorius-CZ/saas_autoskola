"use client";

import { useState } from "react";

/**
 * Osobní odkaz žáka na rozvrh.
 *
 * Nechrání ho heslo — dohodnuto vědomě: žáci nemají účty a starost o to,
 * komu odkaz pošlou dál, je jejich. Proto to tady stojí napsané, aby to
 * nikoho později nepřekvapilo.
 */
export default function OdkazNaRozvrh({
  adresa,
  komu,
  jmeno,
}: {
  adresa: string;
  komu: string | null;
  jmeno: string;
}) {
  const [zkopirovano, setZkopirovano] = useState(false);

  async function zkopiruj() {
    try {
      await navigator.clipboard.writeText(adresa);
      setZkopirovano(true);
      setTimeout(() => setZkopirovano(false), 2000);
    } catch {
      // Prohlížeč schránku nepustil (starší Safari, http). Nic se neděje —
      // odkaz je vidět a dá se označit myší.
      setZkopirovano(false);
    }
  }

  const predmet = encodeURIComponent("Rozvrh výcviku v autoškole");
  const telo = encodeURIComponent(
    `Dobrý den,\n\nna téhle adrese uvidíte svůj rozvrh a můžete si ho přidat do kalendáře v telefonu:\n\n${adresa}\n\nOdkaz je osobní — kdo ho dostane, uvidí váš rozvrh.\n`,
  );

  return (
    <div className="col-span-full">
      <p className="text-xs text-neutral-500">Osobní odkaz na rozvrh</p>

      <p className="mt-0.5 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs dark:bg-neutral-900">
        {adresa}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={zkopiruj}
          className="text-neutral-500 underline-offset-4 hover:underline"
        >
          {zkopirovano ? "Zkopírováno" : "Kopírovat"}
        </button>

        <a
          href={adresa}
          target="_blank"
          rel="noreferrer"
          className="text-neutral-500 underline-offset-4 hover:underline"
        >
          Otevřít
        </a>

        {komu ? (
          <a
            href={`mailto:${komu}?subject=${predmet}&body=${telo}`}
            className="text-neutral-500 underline-offset-4 hover:underline"
          >
            Poslat {jmeno} e-mailem
          </a>
        ) : (
          <span className="text-xs text-neutral-400">
            (e-mail není vyplněný, poslat nejde)
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        Odkaz není chráněný heslem. Kdo ho dostane, uvidí rozvrh — jméno,
        termíny, učitele. Nic jiného tam není.
      </p>
    </div>
  );
}
