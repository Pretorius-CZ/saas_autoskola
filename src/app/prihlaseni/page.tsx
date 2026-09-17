"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { signIn } from "@/lib/auth-client";

type Hlaska = { text: string; vazna: boolean };

export default function Prihlaseni() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [hlaska, setHlaska] = useState<Hlaska | null>(null);
  const [probiha, setProbiha] = useState(false);

  async function odeslat(e: React.FormEvent) {
    e.preventDefault();
    setHlaska(null);
    setProbiha(true);

    const { error } = await signIn.email({ email, password: heslo });

    if (error) {
      const stav = error.status ?? 0;

      if (stav === 401 || stav === 403) {
        // Skutečně špatné přihlašovací údaje. Schválně nerozlišujeme
        // "neznámý e-mail" a "špatné heslo" — rozdíl by cizímu člověku
        // prozradil, kdo u nás účet má.
        setHlaska({
          text: "Přihlášení se nepovedlo. Zkontroluj e-mail a heslo.",
          vazna: false,
        });
      } else {
        // Všechno ostatní je chyba na naší straně. Neposílej člověka
        // hledat překlep v hesle, které je v pořádku.
        setHlaska({
          text: "Systém teď nefunguje. Není to tvým heslem — zkus to prosím za chvíli.",
          vazna: true,
        });

        // Skutečnou příčinu chceme vidět, i když ji na obrazovku nedáme.
        Sentry.captureException(
          new Error(`Přihlášení selhalo: ${error.status} ${error.statusText ?? ""}`),
          { extra: { code: error.code, message: error.message } },
        );
      }

      setProbiha(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold">Autoškola</h1>
      <p className="mt-1 text-sm text-neutral-500">Přihlaš se do systému.</p>

      <form onSubmit={odeslat} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm text-neutral-500">E-mail</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-500">Heslo</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {hlaska ? (
          <p
            className={
              hlaska.vazna
                ? "rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
            }
          >
            {hlaska.text}
            {hlaska.vazna ? (
              <>
                {" "}
                <Link href="/zdravi" className="underline underline-offset-4">
                  Stav systému
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={probiha}
          className="tlacitko w-full"
        >
          {probiha ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-neutral-400">
        <Link href="/zdravi" className="underline-offset-4 hover:underline">
          Stav systému
        </Link>
      </p>
    </main>
  );
}
