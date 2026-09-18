"use client";

import { useActionState, useState } from "react";
import Kopirovat from "@/components/kopirovat";
import {
  noveHeslo,
  pozvankaProUcitele,
  vytvorPrihlaseni,
  zrusPrihlaseni,
  type StavUctu,
} from "./akce-ucty";

/**
 * Přihlášení učitele na kartě učitele.
 *
 * Heslo se ukáže jednou, hned po vytvoření. Je to schválně nápadné —
 * kdo ho v tu chvíli nepředá, musí udělat nové. Přečíst to staré nejde
 * nikomu, v databázi je jen otisk.
 */
export default function PrihlaseniUcitele({
  ucitelId,
  email,
  maUcet,
  uctovyEmail,
}: {
  ucitelId: string;
  email: string | null;
  maUcet: boolean;
  uctovyEmail: string | null;
}) {
  const [stavVytvor, akceVytvor, vytvariSe] = useActionState<StavUctu, FormData>(
    vytvorPrihlaseni,
    {},
  );
  const [stavHeslo, akceHeslo, meniSe] = useActionState<StavUctu, FormData>(
    noveHeslo,
    {},
  );
  const [stavZrus, akceZrus, rusiSe] = useActionState<StavUctu, FormData>(
    zrusPrihlaseni,
    {},
  );

  const [stavPozvanka, akcePozvanka, zveSe] = useActionState<StavUctu, FormData>(
    pozvankaProUcitele,
    {},
  );

  const [ptamSe, setPtamSe] = useState(false);

  const heslo = stavVytvor.heslo ?? stavHeslo.heslo;
  const odkaz = stavPozvanka.odkaz;
  const chyba =
    stavVytvor.chyba ?? stavHeslo.chyba ?? stavZrus.chyba ?? stavPozvanka.chyba;


  return (
    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">Přihlášení do aplikace</p>

      {heslo ? (
        <div className="mt-1 rounded-lg border border-emerald-500 p-3">
          <p className="text-sm font-medium">Heslo — opiš si ho teď</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-lg">{heslo}</p>
            <Kopirovat text={heslo} popis="Kopírovat heslo" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Podruhé se nezobrazí a přečíst ho nejde ani mně. Když se ztratí,
            udělá se nové.
          </p>
        </div>
      ) : null}

      {odkaz ? (
        <div className="mt-1 rounded-lg border border-emerald-500 p-3">
          <p className="text-sm font-medium">
            Pozvánka — pošli mu tenhle odkaz
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-xs">{odkaz}</p>
            <Kopirovat text={odkaz} popis="Kopírovat odkaz" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Platí {stavPozvanka.dnu ?? 7} dní a jde použít jednou. Heslo si
            zvolí sám — nikdo jiný ho neuvidí, ani ty.
          </p>
        </div>
      ) : null}

      {maUcet ? (
        <>
          <p className="mt-0.5 text-sm">
            Přihlašuje se e-mailem{" "}
            <span className="font-medium">{uctovyEmail ?? email}</span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={akceHeslo}>
              <input type="hidden" name="ucitelId" value={ucitelId} />
              <button type="submit" disabled={meniSe} className="tlacitko-vedlejsi">
                {meniSe ? "Měním…" : "Nové heslo"}
              </button>
            </form>

            {ptamSe ? (
              <form action={akceZrus} className="flex items-center gap-2">
                <input type="hidden" name="ucitelId" value={ucitelId} />
                <span className="text-sm">Opravdu zrušit přihlášení?</span>
                <button type="submit" disabled={rusiSe} className="tlacitko-vedlejsi">
                  {rusiSe ? "Ruším…" : "Ano, zrušit"}
                </button>
                <button
                  type="button"
                  onClick={() => setPtamSe(false)}
                  className="text-sm text-neutral-500 underline-offset-4 hover:underline"
                >
                  Ne
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setPtamSe(true)}
                className="text-sm text-neutral-500 underline-offset-4 hover:underline"
              >
                Zrušit přihlášení
              </button>
            )}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Nové heslo odhlásí všechna jeho zařízení. Zrušení smaže účet,
            záznam učitele v evidenci zůstává.
          </p>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-sm text-neutral-500">
            {email
              ? `Zatím nemá. Přihlašoval by se e-mailem ${email}.`
              : "Zatím nemá. Nejdřív mu v úpravě doplň e-mail — přihlašuje se jím."}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={akcePozvanka}>
              <input type="hidden" name="ucitelId" value={ucitelId} />
              <button type="submit" disabled={zveSe || !email} className="tlacitko">
                {zveSe ? "Vytvářím…" : "Vytvořit pozvánku"}
              </button>
            </form>

            <form action={akceVytvor}>
              <input type="hidden" name="ucitelId" value={ucitelId} />
              <button
                type="submit"
                disabled={vytvariSe || !email}
                className="tlacitko-vedlejsi"
              >
                {vytvariSe ? "Vytvářím…" : "Rovnou nastavit heslo"}
              </button>
            </form>
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Pozvánkou si heslo zvolí sám a nikam necestuje — to je ta lepší
            cesta. Druhé tlačítko vygeneruje heslo, které mu musíš předat
            osobně; hodí se, když sedíte u jednoho stolu.
          </p>
        </>
      )}

      {chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{chyba}</p>
      ) : null}
    </div>
  );
}
