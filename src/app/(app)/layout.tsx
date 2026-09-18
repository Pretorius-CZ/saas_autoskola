import Link from "next/link";
import { vyzadujSpravce } from "@/lib/relace";
import Odhlaseni from "@/components/odhlaseni";

// Chráněná část aplikace se nesmí cachovat — vždy se ptáme, kdo se dívá.
export const dynamic = "force-dynamic";

const odkazy = [
  { href: "/", popis: "Přehled" },
  { href: "/kalendar", popis: "Kalendář" },
  { href: "/zaci", popis: "Žáci" },
  { href: "/kurzy", popis: "Kurzy" },
  { href: "/sestavy", popis: "Sestavy" },
  { href: "/ucitele", popis: "Učitelé" },
  { href: "/vozidla", popis: "Vozidla" },
  { href: "/nastaveni", popis: "Nastavení" },
  { href: "/stav", popis: "Stav" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tohle je ta jediná řádka, která drží celou chráněnou část zavřenou.
  // Učitel se sem nedostane — má vlastní část v /ucitel. Není to jen
  // schované menu: kontrola je tady, nad všemi stránkami uvnitř.
  const kdo = await vyzadujSpravce();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="netisknout flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          {kdo.autoskola.logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${kdo.autoskola.logoTyp};base64,${kdo.autoskola.logoData}`}
              alt=""
              className="max-h-10 w-auto"
            />
          ) : null}
          <div>
          <p className="font-semibold">{kdo.autoskola.nazev}</p>
          <p className="text-sm text-neutral-500">
            {kdo.jmeno}
            {kdo.role === "spravce" ? " · správce" : null}
          </p>
          </div>
        </div>
        <Odhlaseni />
      </header>

      <nav className="netisknout flex gap-4 overflow-x-auto py-4 text-sm">
        {odkazy.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="whitespace-nowrap text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            {o.popis}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
