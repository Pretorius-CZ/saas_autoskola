# Autoškola — informační systém

Vlastní systém pro vedení autoškoly podle zákona č. 247/2000 Sb.
a vyhlášky č. 167/2002 Sb. První verze cílí na jeden svislý řez:
jeden kurz skupiny B od přijetí žadatele po přihlášení ke zkoušce.

---

## Co tenhle týden děláme

Cílem prvního týdne **není žádná funkce pro autoškolu**. Cílem je, aby
existovalo místo, kam se dá funkce příští týden položit: projekt, databáze,
nasazení na internetu, sledování chyb a ověřená záloha.

Odměna za týden je jediná stránka, která ti zeleně nebo červeně řekne,
jestli všechno drží pohromadě. Až budou všechny řádky zelené i na adrese
na internetu (ne jen na tvém počítači), je první týden hotový.

---

## Jak projekt spustit u sebe

Potřebuješ Node.js 20 nebo novější a Git — ty už máš.

### 1. Doinstalovat balíčky

V PowerShellu ve složce projektu:

```powershell
npm install drizzle-orm pg zod dotenv
npm install -D drizzle-kit @types/pg
```

### 2. Doplnit příkazy do `package.json`

Do `package.json` do části `"scripts"` přidej dva řádky (za ty, co tam už jsou —
nezapomeň čárku na konci předchozího řádku):

```json
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

- `npm run db:push` — přenese popis tabulek z kódu do databáze
- `npm run db:studio` — otevře v prohlížeči jednoduchý pohled do dat

### 3. Vyrobit `.env.local`

Zkopíruj `.env.example` jako `.env.local` a doplň skutečný připojovací
řetězec z Neonu:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

`.env.local` je v `.gitignore` a na GitHub se nikdy nedostane. Heslo
k databázi je v něm otevřeně — nikam ho nekopíruj, neposílej mailem.

### 4. Vytvořit první tabulku

```powershell
npm run db:push
```

Drizzle se zeptá, co má udělat; u prázdné databáze jen odsouhlas vytvoření
tabulky `tenants`.

### 5. Spustit

```powershell
npm run dev
```

Otevři <http://localhost:3000>. Měl bys vidět stavovou stránku se čtyřmi
řádky. Všechny čtyři mají svítit zeleně.

---

## Co která část je

| Soubor | K čemu je |
|---|---|
| `src/lib/env.ts` | Jediné místo, kde se čtou proměnné prostředí. Nikde jinde `process.env`. |
| `src/db/schema.ts` | Popis tabulek. Zdroj pravdy — databáze se přizpůsobuje jemu, ne naopak. |
| `src/db/index.ts` | Připojení k databázi. Záměrně obyčejný postgres, ne ovladač od Neonu. |
| `drizzle.config.ts` | Nastavení pro `db:push` a `db:studio`. |
| `src/app/page.tsx` | Stavová stránka — čtyři kontroly, zelená nebo červená. |
| `push.ps1` | Commit a push na jeden příkaz. |

---

## Ukládání práce

Místo tří příkazů stačí jeden:

```powershell
.\push.ps1 "přidal jsem stavovou stránku"
```

Skript sám přidá všechny změny, udělá commit a odešle ho na GitHub.
Když popis nenapíšeš, doplní se datum a čas. Když není co ukládat,
jen to oznámí.

Pokud PowerShell odmítne skript spustit kvůli zásadám spouštění, povol
skripty pro svého uživatele (stačí jednou):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## Zbytek prvního týdne

Po bodech výše zbývá:

1. **Nasadit na Vercel** — projekt propojit s repozitářem na GitHubu,
   do nastavení projektu na Vercelu vložit `DATABASE_URL` jako
   *Environment Variable* (Production i Preview). Pak otevřít vygenerovanou
   adresu a zkontrolovat, že jsou na ní stejné čtyři zelené řádky.
2. **Sentry** — sledování chyb, při zakládání účtu zvolit **EU** úložiště.
   Zvolit region nejde později změnit.
3. **Záloha** — ručně stáhnout dump databáze a *skutečně ho obnovit*
   do prázdné databáze. Záloha, kterou jsi nikdy neobnovil, není záloha.

---

## Dvě rozhodnutí, která nejdou vzít zpět

- **Region databáze i Sentry musí být v EU** (Neon: Europe/Frankfurt).
  Vedeme rodná čísla a doklady totožnosti. Region se u obou mění jedině
  založením nového účtu a stěhováním dat.
- **Databáze zůstává přenositelná.** Proto obyčejný postgresový ovladač
  a žádné funkce specifické pro jednoho poskytovatele.

---

## Kam dál

Podrobné zadání, datový model, právní rozbor a plán třinácti týdnů jsou
v dokumentech k projektu (Zadání MVP, Přijetí žáka, Výuka a výcvik,
Zkoušky a přihláška, Anatomie nepřehlednosti, Autoškola jako SaaS).
