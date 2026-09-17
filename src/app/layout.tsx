import type { Metadata } from "next";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autoškola",
  description: "Systém pro správu autoškoly",
};

/**
 * Motiv se ukládá u autoškoly, takže ho musíme znát ještě před vykreslením
 * stránky — barvy patří na <html>, ne až někam dovnitř.
 *
 * Když se to nepovede (třeba na přihlašovací obrazovce, kde ještě nevíme,
 * kdo se dívá), platí "podle systému". Chyba tady nesmí shodit celou
 * aplikaci kvůli barvičkám.
 */
async function vzhled(): Promise<{ motiv: string; barva: string }> {
  const vychozi = { motiv: "auto", barva: "seda" };

  try {
    const relace = await auth.api.getSession({ headers: await headers() });
    const tenantId = (relace?.user as { tenantId?: string | null } | undefined)?.tenantId;
    if (!tenantId) return vychozi;

    const db = getDb();
    if (!db) return vychozi;

    const [t] = await db
      .select({ motiv: tenants.motiv, barva: tenants.barva })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return { motiv: t?.motiv ?? "auto", barva: t?.barva ?? "seda" };
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
