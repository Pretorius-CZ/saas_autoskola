import Link from "next/link";
import { rozsah } from "@/lib/cas";
import ZrusitTermin from "./zrusit-termin";

/**
 * Jeden termín v kalendáři.
 *
 * Používá ho denní i týdenní pohled. Schválně na jednom místě: dvě kopie
 * téhož výpisu by se dřív nebo později rozešly a jedna by přestala
 * ukazovat, co druhá umí.
 */
export type Polozka = {
  id: string;
  zacatek: Date;
  delkaMinut: number;
  druh: string;
  stav: string;
  tema: string | null;
  vycvikId: string | null;
  ucitel: string | null;
  vozidlo: string | null;
  kurz: string | null;
  zak: string | null;
  barva: string;
};

export default function PolozkaTerminu({
  t,
  velka = false,
}: {
  t: Polozka;
  /** V denním pohledu je místa dost, tak ať je to čitelné na dálku. */
  velka?: boolean;
}) {
  return (
    <li
      className={`border-l-4 pl-2 ${velka ? "py-1" : ""} ${
        t.stav === "zruseno"
          ? "border-l-neutral-300 opacity-50 dark:border-l-neutral-700"
          : t.barva
      }`}
    >
      <p className={velka ? "text-base" : "text-sm"}>
        <Link
          href={`/kalendar/${t.id}`}
          className="font-medium tabular-nums underline-offset-4 hover:underline"
        >
          {rozsah(t.zacatek, t.delkaMinut)}
        </Link>
        {t.stav === "zruseno" ? (
          <span className="ml-1 text-xs text-neutral-500">zrušeno</span>
        ) : t.stav === "probehlo" ? (
          <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">✓</span>
        ) : null}
      </p>

      <p className={velka ? "text-base" : "text-sm"}>
        {t.druh === "teorie" ? (
          <>
            <span className="text-neutral-500">teorie · </span>
            {t.kurz ?? "—"}
          </>
        ) : t.zak && t.vycvikId ? (
          <Link
            href={`/zaci/${t.vycvikId}`}
            className="underline-offset-4 hover:underline"
          >
            {t.zak}
          </Link>
        ) : (
          "—"
        )}
      </p>

      <p className="text-xs text-neutral-500">
        {[t.ucitel, t.vozidlo, t.tema].filter(Boolean).join(" · ")}
      </p>

      {t.stav !== "zruseno" ? (
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <Link
            href={`/kalendar/${t.id}?upravit=1`}
            className="rounded border border-blue-500/50 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
          >
            upravit
          </Link>
          <ZrusitTermin id={t.id} />
        </div>
      ) : null}
    </li>
  );
}
