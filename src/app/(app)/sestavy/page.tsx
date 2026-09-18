import Link from "next/link";

export const dynamic = "force-dynamic";

const sestavy = [
  {
    href: "/sestavy/evidencni-kniha",
    nazev: "Evidenční kniha",
    popis:
      "Seznam žadatelů podle evidenčních čísel s jejich daty: zahájení a ukončení výcviku, přihláška, zkoušky. Jeden řádek na jeden výcvik.",
  },
  {
    href: "/sestavy/tridni-kniha",
    nazev: "Třídní kniha",
    popis:
      "Vede se po kurzech — každý kurz má svou. Seznam zařazených žáků a záznam o výuce: kdy, co se probíralo, kdo učil a kdo byl přítomen.",
  },
  {
    href: "/zaci",
    nazev: "Výuka a výcvik žáka",
    popis:
      "Doložená výuka a dokončené jízdy jednoho žáka, u jízd i s jeho podpisem. Otevírá se z karty žáka odkazem „Sestava k vytištění“.",
  },
  {
    href: "/sestavy/kniha-jizd",
    nazev: "Kniha jízd",
    popis:
      "Záznam o výcviku: kdy, s kým, kterým vozidlem a jak dlouho.",
  },
];

export default function Sestavy() {
  return (
    <main>
      <h1 className="text-lg font-semibold">Sestavy</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sestavy nic nepočítají navíc — jen jinak vypisují to, co už v evidenci
        je. Když v nich něco chybí, chybí to v evidenci a je potřeba to doplnit
        tam, ne tady.
      </p>

      <ul className="mt-4 space-y-3">
        {sestavy.map((s) => (
          <li
            key={s.href}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <Link href={s.href} className="font-medium underline-offset-4 hover:underline">
              {s.nazev}
            </Link>
            <p className="mt-1 text-sm text-neutral-500">{s.popis}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
