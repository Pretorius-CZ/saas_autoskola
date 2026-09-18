import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { accounts, sessions, users } from "@/db/schema";

/**
 * Zakládání a rušení přihlášení pro učitele.
 *
 * Účty si nikdo nezakládá sám (viz disableSignUp v auth.ts) — zakládá je
 * správce autoškoly odsud. Heslo se vygeneruje, ukáže se jednou a víc už
 * ho nikdo nepřečte: v databázi leží jen jeho otisk.
 *
 * Hašování si NEDĚLÁME sami. Bereme si ho z Better Auth, aby ověření při
 * přihlášení počítalo otisk úplně stejně. Kdyby se to po aktualizaci
 * knihovny rozešlo, spadne to tady s jasnou hláškou — ne tiše až u
 * přihlašování.
 */

// Bez znaků, které se pletou: l, I, 1, O, 0.
const ABECEDA = "abcdefghijkmnpqrstuvwxyz23456789";

export function vygenerujHeslo(): string {
  // 256 / 32 vyjde přesně, takže žádný znak není pravděpodobnější.
  const bajty = randomBytes(15);
  let out = "";
  for (const b of bajty) out += ABECEDA[b % ABECEDA.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}`;
}

async function zahashuj(heslo: string): Promise<string> {
  const kontext = await auth.$context;
  const hash = kontext?.password?.hash;

  if (typeof hash !== "function") {
    throw new Error(
      "Better Auth nevrátil funkci na zahašování hesla. Po aktualizaci knihovny zkontroluj src/lib/ucty.ts.",
    );
  }

  return hash(heslo);
}

function databaze() {
  const db = getDb();
  if (!db) throw new Error("Databáze není dostupná.");
  return db;
}

export type NovyUcet = { userId: string; heslo: string };

export async function zalozUcet(udaje: {
  tenantId: string;
  jmeno: string;
  email: string;
  role: string;
  /** Když si heslo volí sám uživatel (pozvánka). Jinak se vygeneruje. */
  heslo?: string;
}): Promise<NovyUcet> {
  const db = databaze();
  const email = udaje.email.trim().toLowerCase();

  const [obsazeny] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (obsazeny) {
    throw new Error(`Účet s e-mailem ${email} už existuje.`);
  }

  const heslo = udaje.heslo ?? vygenerujHeslo();
  const userId = randomUUID();

  await db.insert(users).values({
    id: userId,
    name: udaje.jmeno,
    email,
    // Neověřený, protože ověřený není. Přihlášení to nebrání, ověřování
    // e-mailu zapnuté nemáme — ale lhát si do evidence nebudeme.
    emailVerified: false,
    tenantId: udaje.tenantId,
    role: udaje.role,
  });

  await db.insert(accounts).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: await zahashuj(heslo),
  });

  return { userId, heslo };
}

/** Nové heslo. Odhlásí všechna zařízení — staré heslo už nemá platit nikde. */
export async function noveHesloUctu(userId: string): Promise<string> {
  const db = databaze();
  const heslo = vygenerujHeslo();

  const zmeneno = await db
    .update(accounts)
    .set({ password: await zahashuj(heslo), updatedAt: new Date() })
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .returning({ id: accounts.id });

  if (zmeneno.length === 0) {
    throw new Error("Účet nemá heslo, které by šlo změnit.");
  }

  await db.delete(sessions).where(eq(sessions.userId, userId));

  return heslo;
}

/** Zruší přihlášení úplně. Záznam učitele v evidenci zůstává. */
export async function zrusUcet(userId: string): Promise<void> {
  const db = databaze();
  await db.delete(sessions).where(eq(sessions.userId, userId));
  // Účty (a v nich otisk hesla) odejdou s uživatelem, je to nastavené
  // v cizím klíči jako cascade.
  await db.delete(users).where(eq(users.id, userId));
}

/** Uživatel patřící téhle autoškole, nebo nic. */
export async function uzivatelAutoskoly(userId: string, tenantId: string) {
  const db = databaze();
  const [u] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);
  return u ?? null;
}
