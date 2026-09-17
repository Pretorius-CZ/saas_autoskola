"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ulozSlozeniKurzu, upravKurz, zalozKurz, type StavKurzu } from "./akce";

type Kurz = {
  id: string;
  nazev: string;
  skupina: string;
  /** Pro zobrazení: "17. 9. 2026". */
  datumZahajeni: string | null;
  /** Pro políčko: "2026-09-17". */
  datumZahajeniVstup: string;
  poznamka: string | null;
  aktivni: boolean;
};

type Zak = {
  id: string;
  evidencniCislo: number;
  jmeno: string;
  prijmeni: string;
  skupina: string;
  kurzId: string | null;
};

const vstup =
  "mt-0.5 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900";

function Uprava({ kurz, zavri }: { kurz: Kurz; zavri: () => void }) {
  const [stav, akce, probiha] = useActionState<StavKurzu, FormData>(upravKurz, {});

  // Formulář si drží hodnoty sám — po odeslání je React vyprazdňuje.
  const [h, setH] = useState({
    nazev: kurz.nazev,
    skupina: kurz.skupina,
    datumZahajeni: kurz.datumZahajeniVstup,
    poznamka: kurz.poznamka ?? "",
    aktivni: kurz.aktivni,
  });

  useEffect(() => {
    if (stav.hodnoty) {
      setH((p) => ({
        ...p,
        nazev: stav.hodnoty!.nazev ?? p.nazev,
        skupina: stav.hodnoty!.skupina ?? p.skupina,
        datumZahajeni: stav.hodnoty!.datumZahajeni ?? p.datumZahajeni,
        poznamka: stav.hodnoty!.poznamka ?? p.poznamka,
      }));
    }
    if (stav.hotovo) zavri();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stav]);

  const tridy = (klic: string) =>
    `${vstup} ${stav.pole === klic ? "border-red-500" : ""}`;

  return (
    <form action={akce} className="mt-2">
      <input type="hidden" name="id" value={kurz.id} />

      <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Název</span>
          <input
            name="nazev"
            required
            value={h.nazev}
            onChange={(e) => setH((p) => ({ ...p, nazev: e.target.value }))}
            className={tridy("nazev")}
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-xs text-neutral-500">Skupina</span>
          <input
            name="skupina"
            value={h.skupina}
            onChange={(e) => setH((p) => ({ ...p, skupina: e.target.value }))}
            className={tridy("skupina")}
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="text-xs text-neutral-500">Zahájení</span>
          <input
            type="date"
            name="datumZahajeni"
            value={h.datumZahajeni}
            onChange={(e) => setH((p) => ({ ...p, datumZahajeni: e.target.value }))}
            className={tridy("datumZahajeni")}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-neutral-500">Poznámka</span>
          <input
            name="poznamka"
            value={h.poznamka}
            onChange={(e) => setH((p) => ({ ...p, poznamka: e.target.value }))}
            className={tridy("poznamka")}
          />
        </label>

        <label className="col-span-full flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="aktivni"
            value="ano"
            checked={h.aktivni}
            onChange={(e) => setH((p) => ({ ...p, aktivni: e.target.checked }))}
          />
          <span>Kurz běží (neaktivní se nenabízí při plánování)</span>
        </label>
      </div>

      {stav.chyba ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={probiha} className="tlacitko">
          {probiha ? "Ukládám…" : "Uložit"}
        </button>
        <button
          type="button"
          onClick={zavri}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Zpět bez uložení
        </button>
      </div>
    </form>
  );
}

function Slozeni({ kurz, zaci }: { kurz: Kurz; zaci: Zak[] }) {
  const [stav, akce, probiha] = useActionState<StavKurzu, FormData>(ulozSlozeniKurzu, {});
  const [otevreno, setOtevreno] = useState(false);

  const vKurzu = zaci.filter((z) => z.kurzId === kurz.id);

  return (
    <div className="mt-2">
      <p className="text-sm text-neutral-500">
        {vKurzu.length === 0
          ? "zatím bez žáků"
          : vKurzu.map((z) => `${z.jmeno} ${z.prijmeni}`).join(", ")}
      </p>

      {!otevreno ? (
        <button
          onClick={() => setOtevreno(true)}
          className="mt-1 text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Upravit složení
        </button>
      ) : (
        <form action={akce} className="mt-2">
          <input type="hidden" name="kurzId" value={kurz.id} />

          <div className="flex flex-wrap gap-1.5">
            {zaci.map((z) => {
              const vTomhle = z.kurzId === kurz.id;
              const jinde = z.kurzId !== null && !vTomhle;
              return (
                <label
                  key={z.id}
                  title={jinde ? "Žák je zatím v jiném kurzu — zaškrtnutím ho přesuneš sem." : ""}
                  className="cursor-pointer rounded-md border border-neutral-300 px-2 py-1 text-xs has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white dark:border-neutral-700 dark:has-checked:border-white dark:has-checked:bg-white dark:has-checked:text-neutral-900"
                >
                  <input
                    type="checkbox"
                    name="vycvikId"
                    value={z.id}
                    defaultChecked={vTomhle}
                    className="sr-only"
                  />
                  {z.evidencniCislo} · {z.prijmeni} ({z.skupina})
                  {jinde ? " ⟂" : ""}
                </label>
              );
            })}
          </div>

          {stav.chyba ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
          ) : null}

          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={probiha} className="tlacitko">
              {probiha ? "Ukládám…" : "Uložit složení"}
            </button>
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              className="text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Zavřít
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function KurzPolozka({ kurz, zaci }: { kurz: Kurz; zaci: Zak[] }) {
  const [upravuji, setUpravuji] = useState(false);

  return (
    <li className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-medium">
          <Link href={`/kurzy/${kurz.id}`} className="underline-offset-4 hover:underline">
            {kurz.nazev}
          </Link>
          {kurz.aktivni ? null : (
            <span className="ml-2 text-sm font-normal text-neutral-500">neaktivní</span>
          )}
        </p>
        <p className="text-sm text-neutral-500">
          skupina {kurz.skupina}
          {kurz.datumZahajeni ? ` · od ${kurz.datumZahajeni}` : " · bez data zahájení"}
        </p>
      </div>

      {kurz.poznamka ? (
        <p className="mt-1 text-sm text-neutral-500">{kurz.poznamka}</p>
      ) : null}

      {upravuji ? (
        <Uprava kurz={kurz} zavri={() => setUpravuji(false)} />
      ) : (
        <>
          <Slozeni kurz={kurz} zaci={zaci} />
          <button
            onClick={() => setUpravuji(true)}
            className="mt-1 ml-0 text-sm text-neutral-500 underline-offset-4 hover:underline"
          >
            Upravit kurz
          </button>
        </>
      )}
    </li>
  );
}

export default function KurzFormulare({ kurzy, zaci }: { kurzy: Kurz[]; zaci: Zak[] }) {
  const [stav, akce, probiha] = useActionState<StavKurzu, FormData>(zalozKurz, {});
  const [otevreno, setOtevreno] = useState(false);

  return (
    <div className="space-y-4">
      {!otevreno ? (
        <button onClick={() => setOtevreno(true)} className="tlacitko">
          Nový kurz
        </button>
      ) : (
        <form
          action={akce}
          className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-6">
            <label className="block sm:col-span-2">
              <span className="text-xs text-neutral-500">Název</span>
              <input name="nazev" required placeholder="Září 2026" className={vstup} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs text-neutral-500">Skupina</span>
              <input name="skupina" defaultValue="B" className={vstup} />
            </label>
            <label className="block sm:col-span-1">
              <span className="text-xs text-neutral-500">Zahájení</span>
              <input type="date" name="datumZahajeni" className={vstup} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-neutral-500">Poznámka</span>
              <input name="poznamka" className={vstup} />
            </label>
          </div>

          {stav.chyba ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{stav.chyba}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={probiha} className="tlacitko">
              {probiha ? "Zakládám…" : "Založit"}
            </button>
            <button
              type="button"
              onClick={() => setOtevreno(false)}
              className="text-sm text-neutral-500 underline-offset-4 hover:underline"
            >
              Zavřít
            </button>
          </div>
        </form>
      )}

      {kurzy.length === 0 ? (
        <p className="text-sm text-neutral-500">Zatím tu není žádný kurz.</p>
      ) : (
        <ul className="space-y-3">
          {kurzy.map((k) => (
            <KurzPolozka key={k.id} kurz={k} zaci={zaci} />
          ))}
        </ul>
      )}
    </div>
  );
}
