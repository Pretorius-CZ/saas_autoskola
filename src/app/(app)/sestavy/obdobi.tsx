import { naText } from "@/lib/datum";

/**
 * Společné části sestav: výběr období a hlavička.
 *
 * Formulář je obyčejný HTML formulář odesílaný metodou GET. Nepotřebuje
 * tedy vůbec žádný javascript a co je vybrané, je vidět v adrese — takže
 * jde poslat odkaz na konkrétní sestavu nebo si ji uložit do oblíbených.
 */

export type Rozsah = { od: string; do: string };

/** Od prvního dne měsíce do posledního. Nejčastější případ. */
export function tentoMesic(): Rozsah {
  const d = new Date();
  const prvni = new Date(d.getFullYear(), d.getMonth(), 1);
  const posledni = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { od: naText(prvni), do: naText(posledni) };
}

function jeDatum(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function rozsahZAdresy(p: Record<string, string | string[] | undefined>): Rozsah {
  const vychozi = tentoMesic();
  const od = p.od;
  const doData = p.do;

  return {
    od: jeDatum(od) ? od : vychozi.od,
    do: jeDatum(doData) ? doData : vychozi.do,
  };
}

/** Začátek a konec období jako skutečné okamžiky v místním čase. */
export function okamziky(r: Rozsah): { zacatek: Date; konec: Date } {
  return {
    zacatek: new Date(`${r.od}T00:00:00`),
    konec: new Date(`${r.do}T23:59:59.999`),
  };
}

export function jednaHodnota(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

const vstup =
  "mt-0.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

export type Vyber = {
  jmeno: string;
  popis: string;
  hodnota: string;
  moznosti: { hodnota: string; popis: string }[];
};

export default function Obdobi({
  cesta,
  rozsah,
  vybery = [],
}: {
  cesta: string;
  rozsah: Rozsah;
  vybery?: Vyber[];
}) {
  return (
    <form
      action={cesta}
      method="get"
      className="netisknout flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <label className="block">
        <span className="text-xs text-neutral-500">Od</span>
        <input type="date" name="od" defaultValue={rozsah.od} className={`block ${vstup}`} />
      </label>

      <label className="block">
        <span className="text-xs text-neutral-500">Do</span>
        <input type="date" name="do" defaultValue={rozsah.do} className={`block ${vstup}`} />
      </label>

      {vybery.map((v) => (
        <label key={v.jmeno} className="block">
          <span className="text-xs text-neutral-500">{v.popis}</span>
          <select name={v.jmeno} defaultValue={v.hodnota} className={`block ${vstup}`}>
            <option value="">vše</option>
            {v.moznosti.map((m) => (
              <option key={m.hodnota} value={m.hodnota}>
                {m.popis}
              </option>
            ))}
          </select>
        </label>
      ))}

      <button type="submit" className="tlacitko">
        Zobrazit
      </button>
    </form>
  );
}
