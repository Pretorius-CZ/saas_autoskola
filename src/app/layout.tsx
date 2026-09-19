import type { Metadata } from "next";
import { zjistiKdo } from "@/lib/relace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autoškola",
  description: "Systém pro správu autoškoly",
};

/**
 * Motiv se ukládá u autoškoly, takže ho musíme znát ještě před vykreslením
 * stránky — barvy patří na <html>, ne až někam dovnitř.
 *
 * Kdo se dívá, zjišťuje `zjistiKdo`, a to jednou za celé vykreslení.
 * Dřív si to tenhle layout řešil sám a stránka pod ním se ptala znovu —
 * dvě relace a dva dotazy na autoškolu při každém kliknutí.
 *
 * Když se to nepovede (třeba na přihlašovací obrazovce, kde ještě nevíme,
 * kdo se dívá), platí "podle systému". Chyba tady nesmí shodit celou
 * aplikaci kvůli barvičkám.
 */
async function vzhled(): Promise<{ motiv: string; barva: string }> {
  const vychozi = { motiv: "auto", barva: "seda" };

  try {
    const v = await zjistiKdo();
    if (v.stav !== "ok") return vychozi;

    return {
      motiv: v.kdo.autoskola.motiv ?? "auto",
      barva: v.kdo.autoskola.barva ?? "seda",
    };
  } catch {
    return vychozi;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { motiv, barva } = await vzhled();

  return (
    <html lang="cs" data-motiv={motiv} data-barva={barva}>
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
