# test-obnovy.ps1 - overi, ze zaloha jde skutecne obnovit
#
# Pouziti:
#   .\test-obnovy.ps1
#
# Co dela:
#   1. vezme nejnovejsi zalohu ze slozky zalohy-autoskola
#   2. zalozi v Neonu docasnou prazdnou databazi "zaloha_test"
#   3. obnovi do ni zalohu
#   4. vypise, jake tabulky v ni vznikly
#   5. docasnou databazi zase smaze
#
# Tvoje ostra databaze (neondb) se pri tom NIJAK nemeni - jen se z ni cte.
#
# POZOR: zamerne bez diakritiky, viz zaloha.ps1.

Set-Location -Path $PSScriptRoot

$TESTDB = "zaloha_test"

# Externi programy (psql, pg_restore, neon) si pisou na chybovy vystup
# i uplne bezne hlasky. PowerShell by je pri "Stop" povazoval za pad skriptu,
# takze se ridime jejich navratovym kodem a vyhodnocujeme si to sami.
$ErrorActionPreference = "Continue"

function Konec($zprava) {
    Write-Host $zprava -ForegroundColor Red
    exit 1
}

# --- najdi nastroje ---------------------------------------------------------
$bin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name) } -Descending | Select-Object -First 1

if (-not $bin) { Konec "Nenasel jsem pg_restore.exe." }

$pgRestore = $bin.FullName
$psql      = Join-Path $bin.Directory.FullName "psql.exe"

# --- pripojovaci retezec ----------------------------------------------------
$envSoubor = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envSoubor)) { Konec "Chybi .env.local." }

$radek = Select-String -Path $envSoubor -Pattern '^\s*DATABASE_URL_UNPOOLED\s*=' | Select-Object -First 1
if (-not $radek) { Konec "V .env.local chybi DATABASE_URL_UNPOOLED." }

$url = ($radek.Line -split '=', 2)[1].Trim().Trim('"').Trim("'")

# stejny server, jina databaze: .../neondb?... -> .../zaloha_test?...
if ($url -notmatch '^(postgresql://[^/]+)/([^?]+)(\?.*)?$') {
    Konec "Pripojovaci retezec ma necekany tvar."
}
$urlTest = $Matches[1] + "/" + $TESTDB + $Matches[3]

# --- nejnovejsi zaloha ------------------------------------------------------
$slozka = Join-Path (Split-Path $PSScriptRoot -Parent) "zalohy-autoskola"
$zaloha = Get-ChildItem $slozka -Filter "*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $zaloha) { Konec "Ve slozce $slozka zadna zaloha neni. Spust nejdriv .\zaloha.ps1" }

Write-Host "Testuji obnovu ze zalohy: $($zaloha.Name)" -ForegroundColor Cyan

# --- docasna databaze -------------------------------------------------------
Write-Host "Zakladam docasnou databazi $TESTDB ..." -ForegroundColor Cyan
$vytvoreni = & neon databases create --name $TESTDB 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ($vytvoreni | Out-String) -ForegroundColor DarkGray
    Konec "Nepodarilo se zalozit docasnou databazi. Kdyby uz existovala: neon databases delete $TESTDB"
}

$uspech = $false

try {
    # --- pockej, az bude databaze skutecne dostupna --------------------------
    # Neon ji zalozi pres svou spravu; bezici server o ni chvili nevi.
    Write-Host "Cekam, az bude databaze dostupna ..." -ForegroundColor Cyan

    $pripravena = $false
    $posledni = ""
    foreach ($pokus in 1..20) {
        $posledni = & $psql -d $urlTest -v ON_ERROR_STOP=1 -t -c "select 1" 2>&1
        if ($LASTEXITCODE -eq 0) { $pripravena = $true; break }
        Start-Sleep -Seconds 2
    }

    if (-not $pripravena) {
        Write-Host ($posledni | Out-String) -ForegroundColor DarkGray
        Write-Host "Databaze se do 40 s neozvala." -ForegroundColor Red
    }
    else {
        # --- obnova ---------------------------------------------------------
        Write-Host "Obnovuji ..." -ForegroundColor Cyan
        $vystup = & $pgRestore --no-owner --no-privileges -d $urlTest $zaloha.FullName 2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-Host ($vystup | Out-String) -ForegroundColor DarkGray
            Write-Host "pg_restore skoncil chybou. ZALOHA NENI POUZITELNA." -ForegroundColor Red
        }
        else {
            Write-Host ""
            Write-Host "Tabulky v obnovene databazi:" -ForegroundColor Gray

            $dotaz = "select table_name, (select count(*) from information_schema.columns c where c.table_name = t.table_name) as sloupcu from information_schema.tables t where table_schema = 'public' order by table_name;"
            & $psql -d $urlTest -c $dotaz
            if ($LASTEXITCODE -eq 0) { $uspech = $true }
        }
    }
}
finally {
    # --- uklid, at ti tam nezustane viset -----------------------------------
    Write-Host ""
    Write-Host "Mazu docasnou databazi $TESTDB ..." -ForegroundColor Cyan
    & neon databases delete $TESTDB 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docasnou databazi se nepodarilo smazat. Smaz ji rucne:" -ForegroundColor Yellow
        Write-Host "   neon databases delete $TESTDB" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($uspech) {
    Write-Host "OVERENO: zaloha jde obnovit." -ForegroundColor Green
}
else {
    Write-Host "NEOVERENO: obnova neprosla. Nespolehej na tuto zalohu." -ForegroundColor Red
    exit 1
}
