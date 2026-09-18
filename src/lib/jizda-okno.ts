/**
 * Kdy se smí jízda zapisovat.
 *
 * Čas zahájení a stav tachometru mají dokládat, že se něco stalo tehdy,
 * kdy se to stalo. Kdyby šlo zapsat kteroukoli jízdu kdykoli, nedokládají
 * nic — je to jen číslo, které někdo napsal.
 *
 * Proto okno kolem naplánovaného času. Ne přesně na minutu: žák může
 * přijít dřív a čekat do půl by bylo hloupé. Naopak po skončení je okno
 * široké, protože zapsat konec jízdy si učitel může vzpomenout až po
 * návratu do autoškoly.
 *
 * Tenhle soubor NENÍ "use server" — čte ho akce i obrazovka.
 */

/** Zahájit jde nejdřív hodinu před naplánovaným začátkem. */
export const TOLERANCE_PRED_MINUT = 60;

/**
 * Zapsat jde nejdéle šest hodin po naplánovaném konci. Tím se zároveň
 * ošetří večerní jízda, která skončí po půlnoci — zvlášť se to řešit
 * nemusí.
 */
export const TOLERANCE_PO_MINUT = 6 * 60;

export type Okno = { od: Date; do: Date };

export function oknoJizdy(zacatek: Date, delkaMinut: number): Okno {
  return {
    od: new Date(zacatek.getTime() - TOLERANCE_PRED_MINUT * 60_000),
    do: new Date(
      zacatek.getTime() + (delkaMinut + TOLERANCE_PO_MINUT) * 60_000,
    ),
  };
}

export function jeVOkne(zacatek: Date, delkaMinut: number, ted = new Date()): boolean {
  const o = oknoJizdy(zacatek, delkaMinut);
  return ted >= o.od && ted <= o.do;
}

/** Proč to nejde — větou, kterou má smysl přečíst. */
export function procNe(
  zacatek: Date,
  delkaMinut: number,
  ted = new Date(),
): string | null {
  const o = oknoJizdy(zacatek, delkaMinut);

  if (ted < o.od) {
    return `Jízda je naplánovaná na ${zacatek.toLocaleDateString(
      "cs-CZ",
    )} v ${zacatek.toLocaleTimeString("cs-CZ", {
      hour: "numeric",
      minute: "2-digit",
    })}. Zapisovat ji půjde od ${o.od.toLocaleTimeString("cs-CZ", {
      hour: "numeric",
      minute: "2-digit",
    })}.`;
  }

  if (ted > o.do) {
    return `Na tenhle termín (${zacatek.toLocaleDateString(
      "cs-CZ",
    )}) už je pozdě. Zapsat ho zpětně může jen správce autoškoly — a zůstane o tom záznam v historii.`;
  }

  return null;
}
