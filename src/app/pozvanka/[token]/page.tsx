import type { Metadata } from "next";
import { nactiPozvanku } from "@/lib/pozvanky";
import NastaveniHesla from "./formular";

/**
 * Pozvánka učitele — stránka bez přihlášení.
 *
 * Když odkaz neplatí, neříká se proč. Jestli vypršel, byl použitý nebo
 * nikdy neexistoval, je informace, kterou nemá cizí člověk dostat
 * zadarmo.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pozvánka",
  robots: { index: false, follow: false },
};

export default async function Pozvanka({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pozvanka = await nactiPozvanku(token);

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-lg font-semibold">Nastavení hesla</h1>

      {!pozvanka || pozvanka.maUcet ? (
        <p className="mt-2 text-sm text-neutral-500">
          Odkaz neplatí. Buď už byl použitý, nebo mu vypršela platnost —
          požádej autoškolu o nový.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-500">
            {pozvanka.jmeno} {pozvanka.prijmeni} · přihlašovat se budeš
            e-mailem <span className="font-medium">{pozvanka.email}</span>
          </p>

          <NastaveniHesla token={token} />
        </>
      )}
    </main>
  );
}
