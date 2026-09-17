"use client";

import { useState, useTransition } from "react";
import { formatDatum } from "@/lib/datum";
import { ulozMilnik } from "./akce-vycvik";
import type { Milnik } from "@/lib/milniky-typy";

type Hodnoty = Record<Milnik, string | null>;

const POLE: { klic: Milnik; popis: string; pozn: string }[] = [
  { klic: "datumZahajeni", popis: "Zahájení", pozn: "§ 25 — hlásí se úřadu" },
  { klic: "datumUkonceni", popis: "Ukončení", pozn: "spouští lhůtu 15 dnů" },
  { klic: "datumPrihlasky", popis: "Přihláška", pozn: "§ 32" },
  { klic: "datumPrvniZkousky", popis: "1. zkouška", pozn: "spouští lhůtu 12 měsíců" },
  { klic: "datumDokonceni", popis: "Dokončeno", pozn: "§ 39" },
];

/**
 * Data průběhu se mění rovnou tam, kde jsou vidět.
 *
 * Klikneš na datum, přepíšeš, kliknutím jinam se uloží. Žádný formulář
 * dole na stránce, u kterého by se dalo zapomenout zmáčknout tlačítko.
 */
export default function Prubeh({
  id,
  podani,
  pocatecni,
}: {
  id: string;
  podani: string | null;
  pocatecni: Hodnoty;
}) {
  const [h, setH] = useState<Hodnoty>(pocatecni);
  const [upravovane, setUpravovane] = useState<Milnik | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [probiha, zacni] = useTransition();

  function uloz(klic: Milnik, novaHodnota: string) {
    const hodnota = novaHodnota === "" ? null : novaHodnota;
    setUpravovane(null);
    setChyba(null);

    if (hodnota === h[klic]) return;

    const puvodni = h[klic];
    setH((p) => ({ ...p, [klic]: hodnota })); // ukaž změnu hned

    zacni(async () => {
      const { chyba } = await ulozMilnik(id, klic, hodnota);
      if (chyba) {
        setH((p) => ({ ...p, [klic]: puvodni })); // neprošlo — vrať zpět
        setChyba(chyba);
      }
    });
  }

  return (
    <div className="col-span-full">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <div className="sm:col-span-1">
          <p className="text-xs text-neutral-500">Žádost</p>
          <p className="py-1 text-sm">
            {podani ? formatDatum(podani) : <span className="text-neutral-400">—</span>}
          </p>
        </div>

        {POLE.map((p) => (
          <div key={p.klic} className="sm:col-span-1">
            <p className="text-xs text-neutral-500" title={p.pozn}>
              {p.popis}
            </p>

            {upravovane === p.klic ? (
              <input
                type="date"
                autoFocus
                defaultValue={h[p.klic] ?? ""}
                onBlur={(e) => uloz(p.klic, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setUpravovane(null);
                }}
                className="w-full rounded-md border border-neutral-400 bg-white px-1.5 py-0.5 text-sm outline-none dark:border-neutral-500 dark:bg-neutral-900"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setChyba(null);
                  setUpravovane(p.klic);
                }}
                disabled={probiha}
                className="w-full rounded-md border border-dashed border-transparent px-1.5 py-1 text-left text-sm hover:border-neutral-300 disabled:opacity-50 dark:hover:border-neutral-700"
              >
                {h[p.klic] ? (
                  formatDatum(h[p.klic])
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {chyba ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {chyba}
        </p>
      ) : (
        <p className="mt-1 text-xs text-neutral-500">
          Klikni na datum a přepiš ho. Stav výcviku se z těchhle dat dopočítá sám.
        </p>
      )}
    </div>
  );
}
