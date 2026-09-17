"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { proAutoskolu } from "@/lib/db-tenant";
import { vyzadujPrihlaseni } from "@/lib/relace";
import { terminy, ucast, vycviky } from "@/db/schema";

export type StavDochazky = { chyba?: string; hotovo?: boolean };

/**
 * Zapíše docházku na konzultaci.
 *
 * Píše se jen to, co se opravdu změnilo. Kdybychom pokaždé přepsali
 * všechny řádky, historie změn by se zaplnila zápisy o tom, že se nic
 * nestalo — a přestala by být k něčemu.
 */
export async function ulozDochazku(
  _p: StavDochazky,
  f: FormData,
): Promise<StavDochazky> {
  const kdo = await vyzadujPrihlaseni();

  const terminId = f.get("terminId");
  if (typeof terminId !== "string") return { chyba: "Chybí termín." };

  const pritomni = new Set(
    f.getAll("pritomen").filter((v): v is string => typeof v === "string"),
  );

  const chyba = await proAutoskolu(kdo, async (tx) => {
    const [t] = await tx
      .select()
      .from(terminy)
      .where(and(eq(terminy.id, terminId), eq(terminy.tenantId, kdo.autoskola.id)))
      .limit(1);

    if (!t) return "Termín nenalezen.";
    if (!t.kurzId) return "Docházka se vede jen u konzultací.";

    // Aktuální složení kurzu — žák mohl přibýt až po naplánování termínu.
    const clenove = await tx
      .select({ id: vycviky.id })
      .from(vycviky)
      .where(and(eq(vycviky.tenantId, kdo.autoskola.id), eq(vycviky.kurzId, t.kurzId)));

    const stavajici = await tx
      .select()
      .from(ucast)
      .where(and(eq(ucast.tenantId, kdo.autoskola.id), eq(ucast.terminId, terminId)));

    const podleVycviku = new Map(stavajici.map((u) => [u.vycvikId, u]));

    const chybejici = clenove.filter((c) => !podleVycviku.has(c.id));
    if (chybejici.length > 0) {
      await tx.insert(ucast).values(
        chybejici.map((c) => ({
          tenantId: kdo.autoskola.id,
          terminId,
          vycvikId: c.id,
          pritomen: pritomni.has(c.id),
        })),
      );
    }

    // Změnit jen ty, u kterých se hodnota liší.
    const naZapnuti: string[] = [];
    const naVypnuti: string[] = [];

    for (const c of clenove) {
      const radek = podleVycviku.get(c.id);
      if (!radek) continue;
      const ma = pritomni.has(c.id);
      if (radek.pritomen === ma) continue;
      (ma ? naZapnuti : naVypnuti).push(radek.id);
    }

    if (naZapnuti.length > 0) {
      await tx
        .update(ucast)
        .set({ pritomen: true, updatedAt: new Date() })
        .where(and(eq(ucast.tenantId, kdo.autoskola.id), inArray(ucast.id, naZapnuti)));
    }
    if (naVypnuti.length > 0) {
      await tx
        .update(ucast)
        .set({ pritomen: false, updatedAt: new Date() })
        .where(and(eq(ucast.tenantId, kdo.autoskola.id), inArray(ucast.id, naVypnuti)));
    }

    // Zapsaná docházka znamená, že se termín konal.
    if (t.stav === "planovano") {
      await tx
        .update(terminy)
        .set({ stav: "probehlo", updatedAt: new Date() })
        .where(and(eq(terminy.id, terminId), eq(terminy.tenantId, kdo.autoskola.id)));
    }

    return null;
  });

  if (chyba) return { chyba };

  revalidatePath(`/kalendar/${terminId}`);
  revalidatePath("/kalendar");
  revalidatePath("/zaci");
  revalidatePath("/kurzy");
  return { hotovo: true };
}

/** Ruční přepnutí stavu termínu (proběhlo / zpět na naplánováno). */
export async function nastavStavTerminu(id: string, stav: string) {
  const kdo = await vyzadujPrihlaseni();

  if (!["planovano", "probehlo", "zruseno"].includes(stav)) return;

  await proAutoskolu(kdo, (tx) =>
    tx
      .update(terminy)
      .set({ stav, updatedAt: new Date() })
      .where(and(eq(terminy.id, id), eq(terminy.tenantId, kdo.autoskola.id))),
  );

  revalidatePath(`/kalendar/${id}`);
  revalidatePath("/kalendar");
  revalidatePath("/zaci");
}
