"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { nastavHeslo, type StavPozvanky } from "./akce";
import { NEJMENE_ZNAKU } from "@/lib/hesla";

export default function NastaveniHesla({ token }: { token: string }) {
  const [stav, akce, probiha] = useActionState<StavPozvanky, FormData>(
    nastavHeslo,
    {},
  );

  const [heslo, setHeslo] = useState("");
  const [znovu, setZnovu] = useState("");

  if (stav.hotovo) {
    return (
      <div className="mt-6">
        <p className="font-medium text-emerald-600 dark:text-emerald-400">
          Heslo je nastavené.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Tenhle odkaz už podruhé nefunguje — od teď se přihlašuješ e-mailem
          a heslem.
        </p>
        <Link href="/prihlaseni" className="tlacitko mt-4 inline-block">
          Přihlásit se
        </Link>
      </div>
    );
  }

  const vstup =
    "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <form action={akce} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="text-xs text-neutral-500">Nové heslo</span>
        <input
          type="password"
          name="heslo"
          autoComplete="new-password"
          value={heslo}
          onChange={(e) => setHeslo(e.target.value)}
          className={vstup}
        />
      </label>

      <label className="block">
        <span className="text-xs text-neutral-500">Heslo znovu</span>
        <input
          type="password"
          name="znovu"
          autoComplete="new-password"
          value={znovu}
          onChange={(e) => setZnovu(e.target.value)}
          className={vstup}
        />
      </label>

      <p className="text-xs text-neutral-500">
        Aspoň {NEJMENE_ZNAKU} znaků. Zvol si něco, co nemáš nikde jinde.
      </p>

      {stav.chyba ? (
        <p className="text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <button type="submit" disabled={probiha} className="tlacitko w-full">
        {probiha ? "Nastavuji…" : "Nastavit heslo"}
      </button>
    </form>
  );
}
