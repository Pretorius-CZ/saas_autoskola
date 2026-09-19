import Kostra from "@/components/kostra";

/**
 * Co se ukáže, než dorazí data kterékoli stránky ve správě.
 *
 * Next.js tuhle kostru vykreslí okamžitě a obsah do ní doskočí, jakmile
 * databáze odpoví. Při proklikávání uvnitř aplikace je to vidět hned —
 * menu a hlavička zůstanou na místě a překreslí se jen obsah.
 */
export default function Nacitani() {
  return <Kostra karet={4} />;
}
