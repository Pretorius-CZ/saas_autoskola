/**
 * Kostra stránky, která se ukazuje, než dorazí data.
 *
 * Nezrychlí to ani o milisekundu. Mění to ale to, co člověk vidí:
 * místo staré stránky, na které se zdánlivě nic neděje (a tak na ni
 * klikne podruhé), se hned objeví obrys toho, co se načítá.
 *
 * Databáze u nás po pěti minutách nečinnosti usne a její probuzení
 * trvá skoro vteřinu. Tohle je odpověď na tu vteřinu — ne na její
 * délku, ale na to, jak vypadá.
 */

export function Radek({ sirka = "w-full" }: { sirka?: string }) {
  return <div className={`h-4 rounded bg-neutral-200 dark:bg-neutral-800 ${sirka}`} />;
}

export function Karta({ radku = 3 }: { radku?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <Radek sirka="w-1/3" />
      {Array.from({ length: radku }, (_, i) => (
        <Radek key={i} sirka={i % 2 === 0 ? "w-full" : "w-2/3"} />
      ))}
    </div>
  );
}

export default function Kostra({ karet = 3 }: { karet?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <Radek sirka="w-40" />
      <div className="space-y-3">
        {Array.from({ length: karet }, (_, i) => (
          <Karta key={i} />
        ))}
      </div>
      <span className="sr-only">Načítám…</span>
    </div>
  );
}
