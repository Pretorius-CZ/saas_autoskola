import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nactiRozvrh, nazevTerminu } from "./data";
import { denAMesic, nazevDne, rozsah } from "@/lib/cas";
import { adresaAplikace } from "@/lib/env";
import Kopirovat from "@/components/kopirovat";

/**
 * Veřejný rozvrh žáka.
 *
 * Žáci nemají účty — dohodnuto vědomě. Do e-mailu dostanou odkaz s
 * náhodným tokenem a tahle stránka jim ukáže jejich termíny. Kdo odkaz
 * dostane, ten rozvrh uvidí; proto tu není nic navíc: žádné rodné číslo,
 * adresa, telefon ani stav výcviku. Jméno a termíny, nic jiného.
 *
 * Co žák uvidí, neurčuje tenhle soubor, ale pravidlo v databázi (viz
 * npm run db:rls). I kdyby byl dotaz níž napsaný špatně, cizí data
 * databáze nevydá.
 */
export const dynamic = "force-dynamic";

// Odkaz se posílá e-mailem a nemá co dělat ve vyhledávačích.
export const metadata: Metadata = {
  title: "Můj rozvrh",
  robots: { index: false, follow: false },
};

export default async function Rozvrh({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await nactiRozvrh(token);

  if (!data) notFound();

  const odkazNaKalendar = `${adresaAplikace()}/rozvrh/${token}/kalendar.ics`;

  const ted = Date.now();
  const budouci = data.terminy.filter((t) => t.zacatek.getTime() >= ted);
  const probehle = data.terminy
    .filter((t) => t.zacatek.getTime() < ted)
    .reverse();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header>
        <h1 className="text-lg font-semibold">
          {data.jmeno} {data.prijmeni}
        </h1>
        <p className="text-sm text-neutral-500">
          Rozvrh výcviku · skupina {data.skupina}
        </p>
      </header>

      <a
        href={`/rozvrh/${token}/kalendar.ics`}
        className="mt-5 block rounded-xl border border-neutral-200 px-4 py-3 text-center text-sm font-medium dark:border-neutral-800"
      >
        Přidat do kalendáře v telefonu
      </a>
      <p className="mt-1.5 text-xs text-neutral-500">
        Stáhne se soubor, který si telefon sám otevře v kalendáři. Upozorní
        tě hodinu předem.
      </p>

      <div className="mt-3">
        <p className="text-xs text-neutral-500">
          Chceš, aby se změny termínů propisovaly samy? Přidej si tenhle odkaz
          v Google kalendáři přes „Přidat kalendář → Z adresy URL“.
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs dark:bg-neutral-900">
            {odkazNaKalendar}
          </p>
          <Kopirovat text={odkazNaKalendar} popis="Kopírovat odkaz" />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Co tě čeká
        </h2>

        {budouci.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Zatím nic naplánovaného. Až autoškola termín zapíše, objeví se tady.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {budouci.map((t) => (
              <li key={t.id} className="py-3">
                <p className="text-sm">
                  <span className="text-neutral-500">{nazevDne(t.zacatek)} </span>
                  <span className="tabular-nums">{denAMesic(t.zacatek)}</span>{" "}
                  <span className="tabular-nums">
                    {rozsah(t.zacatek, t.delkaMinut)}
                  </span>
                </p>
                <p className="text-sm font-medium">
                  {nazevTerminu(t, data.skupina)}
                </p>
                <p className="text-xs text-neutral-500">
                  {[t.ucitel, t.misto, t.tema].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {probehle.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Co máš za sebou
          </h2>
          <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {probehle.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-500">
                  <span className="tabular-nums">{denAMesic(t.zacatek)}</span>{" "}
                  {nazevTerminu(t, data.skupina)}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-400">
                  {rozsah(t.zacatek, t.delkaMinut)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-neutral-400">
        Tenhle odkaz je jen tvůj. Komu ho pošleš, ten uvidí tvůj rozvrh.
      </p>
    </main>
  );
}
