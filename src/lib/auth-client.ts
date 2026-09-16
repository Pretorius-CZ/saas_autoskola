import { createAuthClient } from "better-auth/react";

/**
 * Bez baseURL — prohlížeč mluví se stejnou adresou, ze které se stránka
 * načetla. Díky tomu funguje stejně na localhostu i na ostré adrese
 * a není co přepínat.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
