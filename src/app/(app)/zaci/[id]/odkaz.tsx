"use client";

import Kopirovat from "@/components/kopirovat";

/**
 * Odkaz žáka do kalendáře.
 *
 * Nechrání ho heslo — dohodnuto vědomě: žáci nemají účty a starost o to,
 * komu odkaz pošlou dál, je jejich. Proto to tady stojí napsané, aby to
 * nikoho později nepřekvapilo.
 */
export default function OdkazNaRozvrh({ adresa }: { adresa: string }) {
  const kalendar = `${adresa}/kalendar.ics`;

  return (
    <div className="col-span-full">
      <p className="text-xs text-neutral-500">
        Odkaz do kalendáře (pro odběr v Google kalendáři)
      </p>

      <div className="mt-0.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs dark:bg-neutral-900">
          {kalendar}
        </p>
        <Kopirovat text={kalendar} />
      </div>

      <p className="mt-1 text-xs text-neutral-500">
        Odkaz není chráněný heslem. Kdo ho dostane, uvidí termíny žáka.
      </p>
    </div>
  );
}
