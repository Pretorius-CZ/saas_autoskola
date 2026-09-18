/**
 * Lidské názvy pro historii změn.
 *
 * V databázi se sloupce jmenují technicky a odkazy jsou dlouhá náhodná
 * čísla. Tady je překlad do češtiny; co tu není, ukáže se tak, jak to
 * v databázi je — radši surový název než vymyšlený.
 */

export const NAZVY_POLI: Record<string, string> = {
  jmeno: "Jméno",
  prijmeni: "Příjmení",
  titul: "Titul",
  rodne_prijmeni: "Rodné příjmení",
  datum_narozeni: "Datum narození",
  misto_narozeni: "Místo narození",
  statni_prislusnost: "Státní příslušnost",
  rodne_cislo_sifr: "Rodné číslo",
  rodne_cislo_konec: "Rodné číslo (konec)",
  ulice: "Ulice",
  mesto: "Obec",
  psc: "PSČ",
  telefon: "Telefon",
  email: "E-mail",
  doklad_typ: "Doklad totožnosti",
  doklad_cislo: "Číslo dokladu",
  evidencni_cislo: "Evidenční číslo",
  skupina: "Skupina",
  druh: "Druh",
  lekarsky_posudek: "Lékařský posudek",
  datum_podani_zadosti: "Podání žádosti",
  datum_zahajeni: "Zahájení výcviku",
  datum_ukonceni: "Ukončení výcviku",
  datum_prihlasky: "Přihláška ke zkoušce",
  datum_prvni_zkousky: "První zkouška",
  datum_dokonceni: "Dokončení zkoušek",
  orp_bydliste: "Úřad podle bydliště",
  ucitel_id: "Učitel",
  kurz_id: "Kurz",
  vozidlo_id: "Vozidlo",
  vycvik_id: "Výcvik",
  stav: "Stav",
  ridicsky_prukaz_cislo: "Číslo řidičského průkazu",
  stavajici_skupiny: "Stávající skupiny",
  poznamka: "Poznámka",
  nazev: "Název",
  ico: "IČO",
  cislo_registrace: "Číslo registrace",
  orp_podani: "Úřad autoškoly",
  motiv: "Motiv vzhledu",
  barva: "Barva",
  logo_data: "Logo",
  aktivni: "Aktivní",
  // učitelé
  cislo_osvedceni: "Číslo osvědčení",
  osvedceni_platnost_do: "Osvědčení platí do",
  zdravotni_zpusobilost_do: "Zdravotní způsobilost do",
  skupiny: "Smí učit skupiny",
  bankovni_ucet: "Bankovní účet",

  // vozidla
  znacka: "Značka",
  typ: "Typ",
  rz: "Registrační značka",
  stk_do: "STK do",

  predmet: "Předmět osnovy",
  zacatek: "Začátek",
  delka_minut: "Délka (minut)",
  tema: "Téma",
  misto: "Místo srazu",
  pritomen: "Přítomen",
};

export const NAZVY_AKCI: Record<string, string> = {
  vznik: "záznam vznikl",
  zmena: "změna",
  smazani: "záznam smazán",
};

export const NAZVY_TABULEK: Record<string, string> = {
  zaci: "žadatel",
  vycviky: "výcvik",
  kurzy: "kurz",
  terminy: "termín",
  ucast: "docházka",
  ucitele: "učitel",
  vozidla: "vozidlo",
  tenants: "autoškola",
  poznamky_kurzu: "poznámka v třídní knize",
};

/** Sloupce, jejichž hodnota je odkaz jinam — je potřeba ji přeložit na název. */
export const ODKAZY = ["ucitel_id", "kurz_id", "vozidlo_id", "vycvik_id", "zak_id"];

export function jeOdkaz(pole: string | null): boolean {
  return pole !== null && ODKAZY.includes(pole);
}
