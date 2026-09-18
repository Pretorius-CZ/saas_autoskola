import Link from "next/link";
import { vyzadujPrihlaseni } from "@/lib/relace";
import Odhlaseni from "@/components/odhlaseni";

/**
 * Část pro učitele.
 *
 * Dělaná na telefon — učitel ji otevírá v autě a v učebně, ne u stolu.
 * Proto úzký sloupec, velké odkazy a žádné menu přes celou obrazovku.
 */
export const dynamic = "force-dynamic";

export default async function UcitelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const kdo = await vyzadujPrihlaseni();

  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div>
          <p className="font-semibold">{kdo.autoskola.nazev}</p>
          <p className="text-sm text-neutral-500">{kdo.jmeno}</p>
        </div>
        <div className="flex items-center gap-3">
          {kdo.role === "spravce" ? (
            <Link
              href="/"
              className="text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Správa
            </Link>
          ) : null}
          <Odhlaseni />
        </div>
      </header>

      <div className="mt-4">{children}</div>
    </div>
  );
}
