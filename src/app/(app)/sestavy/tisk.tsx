"use client";

/**
 * Tisk sestavy.
 *
 * Tlačítko dělá totéž co Ctrl+P — ale jen ten, kdo to ví, ho zmáčkne.
 * Vytisknout se má samotná sestava, ne menu a filtry: o to se stará
 * pravidlo pro tisk v globals.css, které schová vše se třídou
 * "netisknout".
 */
export default function Tisk() {
  return (
    <button type="button" onClick={() => window.print()} className="tlacitko-vedlejsi netisknout">
      Vytisknout
    </button>
  );
}
