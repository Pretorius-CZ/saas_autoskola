import Kostra from "@/components/kostra";

/**
 * Kostra pro část učitele.
 *
 * Tady na tom záleží nejvíc: učitel otevírá aplikaci na telefonu u auta,
 * často po delší pauze, kdy databáze spí. Prázdná bílá stránka na dvě
 * vteřiny vypadá jako rozbitá aplikace.
 */
export default function Nacitani() {
  return <Kostra karet={3} />;
}
