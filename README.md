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

## Rozjetí na novém počítači

Složku nekopíruj — stáhni projekt z GitHubu. `node_modules` v gitu schválně
není; `npm install` obnoví přesně ty samé verze podle `package-lock.json`.

Nejdřív nainstaluj **Node.js 20+**, **Git** a **PostgreSQL 18** (v instalátoru
nech zaškrtnuté jen *Command Line Tools*, server ani pgAdmin nepotřebuješ).

```powershell
git clone https://github.com/Pretorius-CZ/saas_autoskola.git
cd saas_autoskola
npm install

npm i -g neon@latest
neon login
neon link --project-id wild-moon-18512350 --branch production -y

# zkopíruj .env.local ze starého počítače, nebo doplň chybějící hodnoty:
#   npm run db:role   → nové heslo účtu aplikace (DATABASE_URL)
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
#     → BETTER_AUTH_SECRET
# POZOR: neon link přepíše DATABASE_URL na vlastníka. Po něm ho vrať
# na účet autoskola_app a hodnotu od neon linku ulož jako DATABASE_URL_OWNER.

npm run dev
```

**Co se nepřenese samo:**

- `.env.local` — hesla a klíče (v `.gitignore`, a to je správně)
- složka `zalohy-autoskola` — leží **vedle** projektu, ne v něm

**Co se nestěhuje vůbec:** databáze v Neonu, nasazení na Vercelu a Sentry.
Jsou v cloudu a vázané na tvoje účty. Nový počítač je jen nové okno do téhož.

Jestli PowerShell odmítne spustit skripty:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Dva přístupy do databáze

V `.env.local` jsou dva připojovací řetězce a záměna by byla tichá chyba,
proto rozdíl stojí za zapamatování.

| Proměnná | Účet | Kdo ji používá |
|---|---|---|
| `DATABASE_URL` | `autoskola_app` | aplikace — čte a zapisuje řádky, nic víc |
| `DATABASE_URL_OWNER` | `neondb_owner` | migrace (`db:push`), seed, `db:rls` |
| `DATABASE_URL_UNPOOLED` | `neondb_owner` | zálohy (`pg_dump`) |

**Na Vercelu je jen `DATABASE_URL`.** Nasazená aplikace nemá mít právo
zahodit tabulku, a nemá ho.

Důvod, proč to takhle je: výchozí účet od Neonu má oprávnění `BYPASSRLS`
— ignoruje pravidla o tom, kdo smí vidět který řádek. Dokud se aplikace
připojovala jím, byla izolace dat jen na papíře. Ověřeno měřením, ne úvahou.

Pozor: `neon link` přepíše `DATABASE_URL` zpátky na vlastníka. Poznáš to
podle toho, že `npm run db:rls` začne křičet o `BYPASSRLS`.

## Izolace dat po autoškolách

```powershell
npm run db:role    # vyrobí omezený účet pro aplikaci (a nové heslo)
npm run db:rls     # zapne pravidla a hned je ověří
```

Každá transakce si nastaví `app.tenant_id` a databáze pak vydá jen řádky
té autoškoly. **Bez nastavení nevydá nic** — mlčení znamená nic, ne všechno.

V aplikaci se do databáze chodí výhradně přes `proAutoskolu()`
(`src/lib/db-tenant.ts`). Nastavení platí jen do konce transakce; kdyby ve
spojení zůstalo viset, obsloužil by další požadavek pod cizí autoškolou.

Podmínky `where tenantId = …` v dotazech zůstávají. Databáze je pojistka,
ne náhrada za pečlivost.

**Když přidáš tabulku se sloupcem `tenant_id`**, dopiš ji do seznamu
`TABULKY` v `src/db/rls.ts` a spusť `npm run db:rls`. Jinak zůstane
nechráněná a nic tě na to neupozorní.

## Zálohy

```powershell
.\zaloha.ps1          # stáhne databázi do souboru
.\test-obnovy.ps1     # ověří, že ten soubor jde obnovit
```

Zálohy se ukládají **vedle projektu**, ne do něj — do složky
`zalohy-autoskola`. Je to schválně: jsou v nich osobní údaje žáků
a uvnitř projektu by dřív nebo později skončily na GitHubu.

`test-obnovy.ps1` založí v Neonu dočasnou prázdnou databázi, obnoví do ní
poslední zálohu, vypíše, jaké tabulky vznikly, a databázi zase smaže.
Ostrá databáze se při tom nemění, jen se z ní čte.

Zálohu pusť před každou větší změnou schématu. Test obnovy aspoň jednou
za měsíc — záloha, kterou jsi nikdy neobnovil, není záloha.

Neon má vlastní historii, ale na bezplatném tarifu jen **6 hodin zpátky**.
Proto ty soubory u sebe.

## Co je hotové

**Základy**

- projekt, databáze v Neonu (Frankfurt), migrace
- nasazení na Vercelu, běží na vlastní adrese
- Sentry v EU, ověřené odesláním skutečné chyby,
  vypnuté posílání osobních údajů a obsahu formulářů
- zálohování a **ověřená** obnova

**Autoškola**

- přihlašování e-mailem a heslem, registrace zavřená
- karta autoškoly, čtyři učitelé, čtyři vozidla
- hlídání propadajících lhůt (osvědčení, zdravotní způsobilost, STK)
- izolace dat po autoškolách vynucená databází

## Co zbývá

- zakládání účtů učitelům a žákům (dveře jsou zavřené, klíč nemá nikdo)
- úprava karet učitelů a vozidel v aplikaci (zatím jen přes seed)
- obnova zapomenutého hesla (potřebuje odesílání e-mailů)

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
