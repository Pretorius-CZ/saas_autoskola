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

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$TESTDB = "zaloha_test"

# --- najdi nastroje ---------------------------------------------------------
$bin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name) } -Descending | Select-Object -First 1

if (-not $bin) {
    Write-Host "Nenasel jsem pg_restore.exe." -ForegroundColor Red
    exit 1
}

$pgRestore = $bin.FullName
$psql      = Join-Path $bin.Directory.FullName "psql.exe"

# --- pripojovaci retezec ----------------------------------------------------
$radek = Select-String -Path (Join-Path $PSScriptRoot ".env.local") -Pattern '^\s*DATABASE_URL_UNPOOLED\s*=' |
    Select-Object -First 1

if (-not $radek) {
    Write-Host "V .env.local chybi DATABASE_URL_UNPOOLED." -ForegroundColor Red
    exit 1
}

$url = ($radek.Line -split '=', 2)[1].Trim().Trim('"').Trim("'")

# stejny server, jina databaze: .../neondb?... -> .../zaloha_test?...
if ($url -notmatch '^(postgresql://[^/]+)/([^?]+)(\?.*)?$') {
    Write-Host "Pripojovaci retezec ma necekany tvar." -ForegroundColor Red
    exit 1
}
$urlTest = $Matches[1] + "/" + $TESTDB + $Matches[3]

# --- nejnovejsi zaloha ------------------------------------------------------
$slozka = Join-Path (Split-Path $PSScriptRoot -Parent) "zalohy-autoskola"
$zaloha = Get-ChildItem $slozka -Filter "*.dump" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $zaloha) {
    Write-Host "Ve slozce $slozka zadna zaloha neni. Spust nejdriv .\zaloha.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "Testuji obnovu ze zalohy: $($zaloha.Name)" -ForegroundColor Cyan

# --- docasna databaze -------------------------------------------------------
Write-Host "Zakladam docasnou databazi $TESTDB ..." -ForegroundColor Cyan
neon databases create --name $TESTDB | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nepodarilo se zalozit docasnou databazi." -ForegroundColor Red
    Write-Host "Kdyby uz existovala z minuleho pokusu: neon databases delete $TESTDB" -ForegroundColor Yellow
    exit 1
}

$uspech = $false

try {
    # --- pockej, az bude databaze skutecne dostupna --------------------------
    # Neon ji zalozi pres svou spravu; bezici server o ni chvili nevi.
    Write-Host "Cekam, az bude databaze dostupna ..." -ForegroundColor Cyan
    $pripravena = $false
    foreach ($pokus in 1..20) {
        & $psql -d $urlTest -c "select 1" *> $null
        if ($LASTEXITCODE -eq 0) { $pripravena = $true; break }
        Start-Sleep -Seconds 2
    }

    if (-not $pripravena) {
        Write-Host "Databaze se do 40 s neozvala. Zkus skript pustit znovu." -ForegroundColor Red
        throw "nedostupna"
    }

    # --- obnova -------------------------------------------------------------
    Write-Host "Obnovuji ..." -ForegroundColor Cyan
    & $pgRestore --no-owner --no-privileges -d $urlTest $zaloha.FullName

    if ($LASTEXITCODE -ne 0) {
        Write-Host "pg_restore skoncil chybou. ZALOHA NENI POUZITELNA." -ForegroundColor Red
    }
    else {
        # --- co v obnovene databazi je --------------------------------------
        Write-Host ""
        Write-Host "Tabulky v obnovene databazi:" -ForegroundColor Gray

        $dotaz = "select table_name, (select count(*) from information_schema.columns c where c.table_name = t.table_name) as sloupcu from information_schema.tables t where table_schema = 'public' order by table_name;"
        & $psql -d $urlTest -c $dotaz

        if ($LASTEXITCODE -eq 0) { $uspech = $true }
    }
}
catch {
    # chybu uz jsme vypsali vys, tady jen nechceme cervenou hlasku PowerShellu
}
finally {
    # --- uklid, at ti tam nezustane viset -----------------------------------
    Write-Host ""
    Write-Host "Mazu docasnou databazi $TESTDB ..." -ForegroundColor Cyan
    neon databases delete $TESTDB | Out-Null
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
