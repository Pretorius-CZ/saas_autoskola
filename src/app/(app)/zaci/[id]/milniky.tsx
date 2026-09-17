"use client";

import { useActionState } from "react";
import { ulozMilniky, type StavUlozeni } from "./akce-vycvik";

type Hodnoty = {
  id: string;
  datumZahajeni: string | null;
  datumUkonceni: string | null;
  datumPrihlasky: string | null;
  datumPrvniZkousky: string | null;
  datumDokonceni: string | null;
};

const POLE = [
  { klic: "datumZahajeni", popis: "Zahájení výcviku", pozn: "§ 25 — hlásí se úřadu" },
  { klic: "datumUkonceni", popis: "Ukončení výcviku", pozn: "spouští lhůtu 15 dnů" },
  { klic: "datumPrihlasky", popis: "Přihlášení ke zkoušce", pozn: "§ 32" },
  { klic: "datumPrvniZkousky", popis: "První zkouška", pozn: "spouští lhůtu 12 měsíců" },
  { klic: "datumDokonceni", popis: "Dokončení zkoušek", pozn: "§ 39" },
] as const;

export default function Milniky({ hodnoty }: { hodnoty: Hodnoty }) {
  const [stav, akce, probiha] = useActionState<StavUlozeni, FormData>(ulozMilniky, {});

  return (
    <form action={akce} className="mt-4 space-y-4">
      <input type="hidden" name="id" value={hodnoty.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        {POLE.map((p) => (
          <label key={p.klic} className="block">
            <span className="text-sm text-neutral-500">{p.popis}</span>
            <input
              type="date"
              name={p.klic}
              defaultValue={hodnoty[p.klic] ?? ""}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <span className="mt-1 block text-xs text-neutral-500">{p.pozn}</span>
          </label>
        ))}
      </div>

      {stav.chyba ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {stav.chyba}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={probiha}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {probiha ? "Ukládám…" : "Uložit"}
        </button>
        {stav.ulozeno && !probiha ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Uloženo.</span>
        ) : null}
      </div>
    </form>
  );
}
