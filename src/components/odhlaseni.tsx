"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function Odhlaseni() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/prihlaseni");
        router.refresh();
      }}
      className="text-sm text-neutral-500 underline-offset-4 hover:underline"
    >
      Odhlásit
    </button>
  );
}
