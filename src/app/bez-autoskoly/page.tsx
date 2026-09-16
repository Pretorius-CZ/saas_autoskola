import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Odhlaseni from "@/components/odhlaseni";

export const dynamic = "force-dynamic";

export default async function BezAutoskoly() {
  const relace = await auth.api.getSession({ headers: await headers() });

  if (!relace?.user) {
    redirect("/prihlaseni");
  }

  const uzivatel = relace.user as typeof relace.user & { tenantId?: string | null };

  // Kdyby se to mezitím spravilo (třeba právě proběhl seed), nedrž ho tady.
  if (uzivatel.tenantId) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold">Účet nepatří žádné autoškole</h1>
      <p className="text-sm text-neutral-500">
        Přihlášení proběhlo, ale tenhle účet není přiřazený k autoškole, takže
        nemá co zobrazit. Pokud sis právě založil první účet, spusť v projektu{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          npm run db:seed
        </code>{" "}
        a zkus to znovu.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Zkusit znovu
        </Link>
        <Odhlaseni />
      </div>
    </main>
  );
}
