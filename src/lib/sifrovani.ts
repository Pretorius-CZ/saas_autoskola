import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Šifrování citlivých sloupců (zatím rodné číslo).
 *
 * Proč vůbec: rodné číslo je v podání na zkoušky povinné, takže ho vést
 * musíme. Zároveň je to údaj, se kterým se dá člověku uškodit. Kompromis
 * je ukládat ho tak, aby byl k ničemu i tomu, kdo se k databázi dostane.
 *
 * Použitý postup (AES-256-GCM) navíc pozná, že někdo se zašifrovanou
 * hodnotou v databázi hýbal — rozšifrování pak selže místo toho, aby
 * vrátilo nesmysl.
 *
 * Klíč je v proměnné SIFROVACI_KLIC. Když ho ztratíš, rodná čísla už
 * nikdo nepřečte — ani ty. Ulož si ho tam, kde máš ostatní hesla.
 */

function klic(): Buffer | null {
  if (!env.SIFROVACI_KLIC) return null;
  const b = Buffer.from(env.SIFROVACI_KLIC, "base64");
  return b.length === 32 ? b : null;
}

export function sifrovaniFunguje(): boolean {
  return klic() !== null;
}

export function zasifruj(text: string): string {
  const k = klic();
  if (!k) throw new Error("Není nastavený SIFROVACI_KLIC — rodné číslo nelze uložit.");

  // Náhodná hodnota pro každý zápis: stejné rodné číslo vypadá pokaždé
  // jinak, takže z databáze nejde poznat, kdo se opakuje.
  const iv = randomBytes(12);
  const sifra = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([sifra.update(text, "utf8"), sifra.final()]);
  const znacka = sifra.getAuthTag();

  return [iv.toString("base64"), znacka.toString("base64"), data.toString("base64")].join(".");
}

export function desifruj(ulozene: string | null): string | null {
  if (!ulozene) return null;

  const k = klic();
  if (!k) return null;

  const [iv, znacka, data] = ulozene.split(".");
  if (!iv || !znacka || !data) return null;

  try {
    const sifra = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    sifra.setAuthTag(Buffer.from(znacka, "base64"));
    return Buffer.concat([
      sifra.update(Buffer.from(data, "base64")),
      sifra.final(),
    ]).toString("utf8");
  } catch {
    // Špatný klíč nebo pozměněná data. Raději nic než nesmysl.
    return null;
  }
}
