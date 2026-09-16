import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Sem chodí všechny požadavky na přihlášení, odhlášení a ověření relace.
export const { POST, GET } = toNextJsHandler(auth);
