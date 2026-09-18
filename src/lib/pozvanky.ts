import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { proAutoskolu, proAutoskoluJako, proPozvanku } from "@/lib/db-tenant";
import { pozvanky, ucitele } from "@/db/schema";
import { zalozUcet } from "@/lib/ucty";
import type { Prihlaseny } from "@/lib/relace";

/**
 * Pozvánka učitele.
 *
 * Správce vyrobí jednorázový odkaz, pošle ho a učitel si na něm zvolí
 * heslo. Heslo tedy nikdy nikam necestuje a nezůstane viset v poště.
 *
 * V databázi je jen OTISK odkazu. Kdo se dostane k databázi, přihlášení
 * tím nezíská — otisk se zpátky na odkaz spočítat nedá.
 */

export const PLATNOST_DNU = 7;

export function otisk(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function novyToken(): string {
  // 32 bajtů náhody. Uhodnout se to nedá a nemá smysl to zkoušet.
  return randomBytes(32).toString("base64url");
}

/**
 * Vyrobí pozvánku a vrátí token — jednou. Ukládá se jen jeho otisk.
 * Starší nevyužité pozvánky téhož učitele se zneplatní: platit má vždy
 * jen ten poslední odkaz, který správce poslal.
 */
export async function vytvorPozvanku(
  kdo: Prihlaseny,
  ucitelId: string,
): Promise<string> {
  const token = novyToken();

  const platnostDo = new Date();
  platnostDo.setDate(platnostDo.getDate() + PLATNOST_DNU);

  await proAutoskolu(kdo, async (tx) => {
    await tx
      .delete(pozvanky)
      .where(
        and(
          eq(pozvanky.tenantId, kdo.autoskola.id),
          eq(pozvanky.ucitelId, ucitelId),
          isNull(pozvanky.pouzitoKdy),
        ),
      );

    await tx.insert(pozvanky).values({
      tenantId: kdo.autoskola.id,
      ucitelId,
      tokenOtisk: otisk(token),
      platnostDo,
    });
  });

  return token;
}

export type OtevrenaPozvanka = {
  ucitelId: string;
  tenantId: string;
  jmeno: string;
  prijmeni: string;
  email: string | null;
  maUcet: boolean;
};

/** Co je za odkazem, nebo nic. Důvod se ven schválně nevysvětluje. */
export async function nactiPozvanku(token: string): Promise<OtevrenaPozvanka | null> {
  if (!token) return null;

  const hledany = otisk(token);

  return proPozvanku(hledany, async (tx) => {
    const [p] = await tx
      .select()
      .from(pozvanky)
      .where(eq(pozvanky.tokenOtisk, hledany))
      .limit(1);

    if (!p) return null;
    if (p.pouzitoKdy) return null;
    if (p.platnostDo.getTime() < Date.now()) return null;

    // Otisky porovnáme ještě jednou v konstantním čase. Dotaz výš je
    // rovnost v databázi, tohle je pás navíc ke šlím.
    const a = Buffer.from(hledany);
    const b = Buffer.from(p.tokenOtisk);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const [u] = await tx
      .select()
      .from(ucitele)
      .where(eq(ucitele.id, p.ucitelId))
      .limit(1);

    if (!u) return null;

    return {
      ucitelId: u.id,
      tenantId: p.tenantId,
      jmeno: u.jmeno,
      prijmeni: u.prijmeni,
      email: u.email,
      maUcet: Boolean(u.userId),
    };
  });
}

/**
 * Vyzvednutí pozvánky: založí účet s heslem, které si učitel zvolil,
 * propojí ho s jeho záznamem a odkaz umrtví.
 */
export async function vyzvedniPozvanku(
  token: string,
  heslo: string,
): Promise<{ chyba?: string }> {
  const pozvanka = await nactiPozvanku(token);
  if (!pozvanka) return { chyba: "Odkaz neplatí. Požádej autoškolu o nový." };
  if (pozvanka.maUcet) return { chyba: "Přihlášení už existuje." };
  if (!pozvanka.email) {
    return { chyba: "U učitele není e-mail, přihlásit se nebude čím." };
  }

  const ucet = await zalozUcet({
    tenantId: pozvanka.tenantId,
    jmeno: `${pozvanka.jmeno} ${pozvanka.prijmeni}`,
    email: pozvanka.email,
    role: "ucitel",
    heslo,
  });

  // Od téhle chvíle už účet existuje, takže se pod něj dá historie
  // podepsat — změnu v evidenci udělal on, ne "nikdo".
  await proAutoskoluJako(pozvanka.tenantId, ucet.userId, async (tx) => {
    await tx
      .update(ucitele)
      .set({ userId: ucet.userId, updatedAt: new Date() })
      .where(
        and(
          eq(ucitele.id, pozvanka.ucitelId),
          eq(ucitele.tenantId, pozvanka.tenantId),
        ),
      );

    await tx
      .update(pozvanky)
      .set({ pouzitoKdy: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(pozvanky.tokenOtisk, otisk(token)),
          eq(pozvanky.tenantId, pozvanka.tenantId),
        ),
      );
  });

  return {};
}
