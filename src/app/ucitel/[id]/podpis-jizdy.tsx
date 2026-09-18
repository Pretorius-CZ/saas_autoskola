"use client";

import { useState, useTransition } from "react";
import Podpis from "@/components/podpis";
import { ulozPodpis } from "./akce";

export default function PodpisJizdy({
  terminId,
  jmeno,
}: {
  terminId: string;
  jmeno: string;
}) {
  const [probiha, prepni] = useTransition();
  const [chyba, setChyba] = useState<string | null>(null);

  function uloz(kresba: string) {
    setChyba(null);
    prepni(async () => {
      const stav = await ulozPodpis(terminId, kresba);
      if (stav.chyba) setChyba(stav.chyba);
    });
  }

  return (
    <div>
      <Podpis jmeno={jmeno} ulozit={uloz} />

      {probiha ? <p className="mt-2 text-sm text-neutral-500">Ukládám…</p> : null}

      {chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{chyba}</p>
      ) : null}
    </div>
  );
}
