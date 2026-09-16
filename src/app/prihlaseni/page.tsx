"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export default function Prihlaseni() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [probiha, setProbiha] = useState(false);

  async function odeslat(e: React.FormEvent) {
    e.preventDefault();
    setChyba(null);
    setProbiha(true);

    const { error } = await signIn.email({ email, password: heslo });

    if (error) {
      // Schválně nerozlišujeme "neznámý e-mail" a "špatné heslo".
      // Rozdíl by cizímu člověku prozradil, kdo u nás účet má.
      setChyba("Přihlášení se nepovedlo. Zkontroluj e-mail a heslo.");
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

        {chyba ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {chyba}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={probiha}
          className="w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {probiha ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </form>
    </main>
  );
}
