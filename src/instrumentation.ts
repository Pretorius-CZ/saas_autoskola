import * as Sentry from "@sentry/nextjs";

/**
 * Časové pásmo se nastavuje tady, protože tenhle soubor Next.js spustí
 * dřív než cokoli jiného na serveru.
 *
 * Celá aplikace počítá s českým časem: "18:00" v kalendáři znamená
 * osmnáctou hodinu v Česku. Bez tohohle by se na Vercelu (běží v UTC)
 * uložil každý naplánovaný termín o dvě hodiny jinam — a uvnitř
 * aplikace by to vypadalo správně, protože by se to i zobrazovalo v UTC.
 *
 * Nastavovat kvůli tomu něco na Vercelu není potřeba — a ani by to
 * nešlo: TZ je tam rezervovaný název. Proto je výchozí hodnota v kódu
 * a přepsat ji jde vlastní proměnnou CASOVE_PASMO, kdyby to někdy bylo
 * třeba (jiná země, testování). Co doopravdy platí, ukazuje /zdravi —
 * a to je jediné, čemu tady věřím.
 */
export async function register() {
  process.env.TZ = process.env.CASOVE_PASMO ?? "Europe/Prague";

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
