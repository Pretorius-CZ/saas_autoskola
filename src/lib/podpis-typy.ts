/**
 * Podpis jako souřadnice tahů.
 *
 * Ne obrázek: souřadnice jsou řádově menší, na papíře zůstanou ostré
 * v jakékoli velikosti a do databáze se tím nedostane nic, co by
 * prohlížeč mohl spustit.
 *
 * Tenhle soubor NENÍ "use server" ani "use client" — čte ho obojí.
 */

export type Kresba = {
  /** Plátno, ve kterém souřadnice platí. */
  sirka: number;
  vyska: number;
  /** Tahy; tah je posloupnost bodů [x, y]. */
  tahy: [number, number][][];
};

/** Strop, aby jeden podpis nezabral půl databáze. */
export const NEJVIC_BODU = 4000;

export function kresbaDoTextu(k: Kresba): string {
  return JSON.stringify({
    sirka: Math.round(k.sirka),
    vyska: Math.round(k.vyska),
    // Desetina pixelu je pro čáru prstem víc než dost a ušetří polovinu místa.
    tahy: k.tahy.map((t) => t.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])),
  });
}

/**
 * Z textu zpátky kresba. Cokoli neočekávaného vrátí null — na vstup
 * z databáze se díváme jako na cizí data, i když jsme ho tam dali sami.
 */
export function kresbaZTextu(text: string | null): Kresba | null {
  if (!text) return null;

  try {
    const d = JSON.parse(text) as unknown;
    if (typeof d !== "object" || d === null) return null;

    const o = d as Record<string, unknown>;
    if (typeof o.sirka !== "number" || typeof o.vyska !== "number") return null;
    if (!Array.isArray(o.tahy)) return null;

    const tahy: [number, number][][] = [];
    for (const t of o.tahy) {
      if (!Array.isArray(t)) return null;
      const tah: [number, number][] = [];
      for (const b of t) {
        if (!Array.isArray(b) || b.length !== 2) return null;
        if (typeof b[0] !== "number" || typeof b[1] !== "number") return null;
        tah.push([b[0], b[1]]);
      }
      tahy.push(tah);
    }

    return { sirka: o.sirka, vyska: o.vyska, tahy };
  } catch {
    return null;
  }
}

export function pocetBodu(k: Kresba): number {
  return k.tahy.reduce((s, t) => s + t.length, 0);
}
