/**
 * Sestavení kalendáře ve formátu iCalendar (.ics).
 *
 * Píšeme si ho sami, protože potřebujeme pár desítek řádků a knihovna by
 * přinesla víc závislostí než užitku. Formát je starý a přísný — hlavně
 * na dvě věci:
 *
 *   1. Řádky končí CRLF a nesmí být delší než 75 oktetů. Delší se lámou
 *      a pokračují mezerou na začátku dalšího řádku. Čeština má háčky po
 *      dvou bajtech, takže se počítají bajty, ne písmena.
 *   2. Středník, čárka a zpětné lomítko mají v textu význam a musí se
 *      odescapovat, jinak se kalendář rozsype na půlce názvu.
 */

export type Udalost = {
  /** Stálý identifikátor. Když se termín změní, kalendář ho podle něj najde. */
  id: string;
  zacatek: Date;
  delkaMinut: number;
  nazev: string;
  popis?: string | null;
  misto?: string | null;
};

function escapuj(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function zalom(radek: string): string[] {
  const kusy: string[] = [];
  let aktualni = "";
  let bajtu = 0;

  for (const znak of radek) {
    const delka = Buffer.byteLength(znak, "utf8");
    // 73 a ne 75: dva oktety si nechávám jako rezervu na CRLF.
    if (bajtu + delka > 73) {
      kusy.push(aktualni);
      aktualni = " ";
      bajtu = 1;
    }
    aktualni += znak;
    bajtu += delka;
  }

  kusy.push(aktualni);
  return kusy;
}

/**
 * Okamžik v UTC, jak ho formát chce: 20260920T063000Z.
 *
 * Tady je toISOString na místě — a jenom tady. V datum.ts je zakázané,
 * protože při počítání s kalendářními dny posune datum o den. Převod
 * jednoho okamžiku do UTC ale dělá přesně to, co se po něm chce.
 */
function utc(datum: Date): string {
  return datum.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function kalendar(
  nazev: string,
  udalosti: Udalost[],
  pripominkaMinut = 60,
): string {
  const ted = utc(new Date());
  const radky: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Autoskola//Rozvrh//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapuj(nazev)}`,
    // Kdo si kalendář přidá odkazem, má se ptát po novinkách jednou za
    // hodinu. Bez toho se u některých kalendářů změna termínu neprojeví
    // celý den.
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const u of udalosti) {
    const konec = new Date(u.zacatek.getTime() + u.delkaMinut * 60_000);

    radky.push(
      "BEGIN:VEVENT",
      `UID:${u.id}@autoskola`,
      `DTSTAMP:${ted}`,
      `DTSTART:${utc(u.zacatek)}`,
      `DTEND:${utc(konec)}`,
      `SUMMARY:${escapuj(u.nazev)}`,
    );

    if (u.popis) radky.push(`DESCRIPTION:${escapuj(u.popis)}`);
    if (u.misto) radky.push(`LOCATION:${escapuj(u.misto)}`);

    if (pripominkaMinut > 0) {
      radky.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:-PT${pripominkaMinut}M`,
        `DESCRIPTION:${escapuj(u.nazev)}`,
        "END:VALARM",
      );
    }

    radky.push("END:VEVENT");
  }

  radky.push("END:VCALENDAR");

  return radky.flatMap(zalom).join("\r\n") + "\r\n";
}
