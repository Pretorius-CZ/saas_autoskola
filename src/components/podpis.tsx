"use client";

import { useEffect, useRef, useState } from "react";
import { NEJVIC_BODU, kresbaDoTextu, pocetBodu, type Kresba } from "@/lib/podpis-typy";

/**
 * Plocha na podpis prstem.
 *
 * Kreslí se do plátna (canvas) kvůli plynulosti — překreslovat React
 * při každém pohybu prstu by na telefonu trhalo. Zdrojem pravdy jsou
 * ale souřadnice, plátno je jen to, co je vidět; ukládají se souřadnice.
 *
 * touch-action: none je tu nutnost, ne kosmetika: bez toho prohlížeč
 * tah po plátně vyhodnotí jako posun stránky a podepsat se nedá.
 */
export default function Podpis({
  jmeno,
  ulozit,
}: {
  jmeno: string;
  ulozit: (kresba: string) => void;
}) {
  const platno = useRef<HTMLCanvasElement | null>(null);
  const tahy = useRef<[number, number][][]>([]);
  const kresli = useRef(false);

  const [prazdne, setPrazdne] = useState(true);
  const [plno, setPlno] = useState(false);

  // Plátno musí mít pixely podle skutečné velikosti na obrazovce,
  // jinak je čára rozmazaná a na telefonu s jemným displejem hnusná.
  useEffect(() => {
    const c = platno.current;
    if (!c) return;

    const pomer = window.devicePixelRatio || 1;
    const sirka = c.clientWidth;
    const vyska = c.clientHeight;

    c.width = Math.round(sirka * pomer);
    c.height = Math.round(vyska * pomer);

    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(pomer, pomer);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
  }, []);

  function bod(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function zacni(e: React.PointerEvent<HTMLCanvasElement>) {
    if (plno) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    kresli.current = true;
    tahy.current.push([bod(e)]);
    setPrazdne(false);
  }

  function tahni(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!kresli.current || plno) return;

    const tah = tahy.current[tahy.current.length - 1];
    const [x, y] = bod(e);
    const [px, py] = tah[tah.length - 1];

    // Body blíž než dva pixely nic nepřidají, jen nafouknou záznam.
    if (Math.hypot(x - px, y - py) < 2) return;

    tah.push([x, y]);

    const ctx = platno.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    if (tahy.current.reduce((s, t) => s + t.length, 0) >= NEJVIC_BODU) {
      setPlno(true);
      kresli.current = false;
    }
  }

  function skonci() {
    kresli.current = false;
  }

  function smaz() {
    tahy.current = [];
    setPrazdne(true);
    setPlno(false);

    const c = platno.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  }

  function odesli() {
    const c = platno.current;
    if (!c || prazdne) return;

    const kresba: Kresba = {
      sirka: c.clientWidth,
      vyska: c.clientHeight,
      tahy: tahy.current,
    };

    if (pocetBodu(kresba) === 0) return;
    ulozit(kresbaDoTextu(kresba));
  }

  return (
    <div>
      <p className="text-sm">
        Podepiš se, {jmeno} — potvrzuješ, že se dnešní jízdy účastníš.
      </p>

      <canvas
        ref={platno}
        onPointerDown={zacni}
        onPointerMove={tahni}
        onPointerUp={skonci}
        onPointerLeave={skonci}
        onPointerCancel={skonci}
        style={{ touchAction: "none" }}
        className="mt-2 h-40 w-full rounded-xl border border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700"
      />

      {plno ? (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Delší podpis se už nevejde. Smaž ho a napiš ho kratší.
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={odesli}
          disabled={prazdne}
          className="tlacitko"
        >
          Uložit podpis
        </button>
        <button
          type="button"
          onClick={smaz}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Smazat
        </button>
      </div>
    </div>
  );
}
