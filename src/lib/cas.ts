/**
 * Práce s časem v kalendáři.
 *
 * Termíny jsou v databázi uložené i s časovým pásmem, ale plánuje se
 * v místním čase — učitel nepřemýšlí v UTC. Převody jsou tady, aby
 * nebyly rozeseté po obrazovkách.
 */

import { naText } from "@/lib/datum";

/** Pondělí toho týdne, do kterého datum spadá. */
export function pondeli(datum: Date): Date {
  const d = new Date(datum);
  d.setHours(0, 0, 0, 0);
  // getDay(): neděle = 0, pondělí = 1
  const posun = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - posun);
  return d;
}

export function pridejDny(datum: Date, dnu: number): Date {
  const d = new Date(datum);
  d.setDate(d.getDate() + dnu);
  return d;
}

/** Sedm dní od pondělí. */
export function tyden(odPondeli: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => pridejDny(odPondeli, i));
}

const DNY = ["pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];

export function nazevDne(datum: Date): string {
  return DNY[(datum.getDay() + 6) % 7];
}

/** "8:30" */
export function cas(datum: Date): string {
  return datum.toLocaleTimeString("cs-CZ", { hour: "numeric", minute: "2-digit" });
}

/** "8:30–10:00" */
export function rozsah(zacatek: Date, delkaMinut: number): string {
  const konec = new Date(zacatek.getTime() + delkaMinut * 60_000);
  return `${cas(zacatek)}–${cas(konec)}`;
}

/** "17. 9." */
export function denAMesic(datum: Date): string {
  return `${datum.getDate()}. ${datum.getMonth() + 1}.`;
}

/** Text pro odkaz v adrese: "2026-09-14". */
export function proAdresu(datum: Date): string {
  return naText(datum);
}

/** Z "2026-09-14" udělá Date v místní půlnoci; nesmysl vrátí jako dnešek. */
export function zAdresy(text: string | undefined): Date {
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Spojí datum "2026-09-14" a čas "08:30" na skutečný okamžik. */
export function okamzik(datum: string, cas: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(cas)) return null;
  const d = new Date(`${datum}T${cas}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Časy, na které se plánuje: každou půlhodinu od šesti ráno do desíti večer.
 * Jiné začátky autoškola nepoužívá a volné psaní času jen zdržuje a plodí
 * překlepy.
 */
export const CASY = Array.from({ length: (22 - 6) * 2 }, (_, i) => {
  const hodina = 6 + Math.floor(i / 2);
  const minuta = i % 2 === 0 ? "00" : "30";
  return `${String(hodina).padStart(2, "0")}:${minuta}`;
});

/** Vyučovací hodina je 45 minut — délky, které dávají smysl nabízet. */
export const DELKY = [
  { minut: 45, popis: "45 min (1 hodina)" },
  { minut: 90, popis: "90 min (2 hodiny)" },
  { minut: 135, popis: "135 min (3 hodiny)" },
  { minut: 180, popis: "180 min (4 hodiny)" },
];
