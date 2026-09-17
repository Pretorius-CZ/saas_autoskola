import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, or } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vycviky, zaci, zmeny } from "@/db/schema";
import { vyzadujPrihlaseni } from "@/lib/relace";
import HistorieTabulka from "@/components/historie-tabulka";
import { nactiNazvyOdkazu } from "@/lib/historie-data";

export const dynamic = "force-dynamic";

export default async function ZmenyZaka({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kdo = await vyzadujPrihlaseni();

  const data = await proAutoskolu(kdo, async (tx) => {
    const [zaznam] = await tx
      .select({ v: vycviky, z: zaci })
      .from(vycviky)
      .innerJoin(zaci, eq(zaci.id, vycviky.zakId))
      .where(and(eq(vycviky.id, id), eq(vycviky.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!zaznam) return null;

    // Historie žáka i jeho výcviku dohromady — pro člověka je to jedna věc.
    const radky = await tx
      .select()
      .from(zmeny)
      .where(
        and(
          eq(zmeny.tenantId, kdo.autoskola.id),
          or(eq(zmeny.zaznamId, zaznam.v.id), eq(zmeny.zaznamId, zaznam.z.id)),
        ),
      )
      .orderBy(desc(zmeny.kdy));

    const { nazvy, lide } = await nactiNazvyOdkazu(tx, radky);

    return { zaznam, radky, nazvy, lide };
  });

  if (!data) notFound();

  const { zaznam, radky, nazvy, lide } = data;

  return (
    <main className="space-y-4">
      <div>
        <Link
          href={`/zaci/${zaznam.v.id}`}
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          ← Zpět na kartu
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-lg font-semibold">
            Historie změn{" "}
            <span className="font-normal text-neutral-500">
              č. {zaznam.v.evidencniCislo} · {zaznam.z.jmeno} {zaznam.z.prijmeni}
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            {radky.length} {radky.length === 1 ? "záznam" : radky.length < 5 ? "záznamy" : "záznamů"}
          </p>
        </div>
      </div>

      <HistorieTabulka radky={radky} nazvy={nazvy} lide={lide} />

      <p className="text-xs text-neutral-500">
        Záznamy do historie zapisuje databáze sama a nejdou upravit ani smazat.
        U rodného čísla se zaznamenává jen to, že se změnilo — hodnota ne.
      </p>
    </main>
  );
}
