# zaloha.ps1 — stáhne celou databázi do souboru u tebe na disku
#
# Použití:
#   .\zaloha.ps1
#
# Zálohy se ukládají VEDLE projektu, ne do něj:
#   ...\claude terminal pokusny\zalohy-autoskola\
# Je to schválně. V záloze jsou osobní údaje žáků a do gitu nesmí nikdy.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# --- 1. najdi pg_dump -------------------------------------------------------
$kandidati = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name) } -Descending

if (-not $kandidati) {
    Write-Host "Nenašel jsem pg_dump.exe." -ForegroundColor Red
    Write-Host "Nainstaluj PostgreSQL 18 Command Line Tools z postgresql.org/download/windows"
    exit 1
}

$pgDump = $kandidati[0].FullName
$verze  = $kandidati[0].Directory.Parent.Name

# --- 2. přečti připojovací řetězec ------------------------------------------
# Pro pg_dump se MUSÍ použít nepoolované připojení (DATABASE_URL_UNPOOLED).
# Poolované spojení dlouhý výpis dat nezvládne.
$envSoubor = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envSoubor)) {
    Write-Host "Chybí .env.local — bez něj nevím, kam se připojit." -ForegroundColor Red
    exit 1
}

$radek = Select-String -Path $envSoubor -Pattern '^\s*DATABASE_URL_UNPOOLED\s*=' |
    Select-Object -First 1

if (-not $radek) {
    Write-Host "V .env.local chybí DATABASE_URL_UNPOOLED." -ForegroundColor Red
    Write-Host "Doplníš ho příkazem: neon link --project-id wild-moon-18512350 --branch production -y"
    exit 1
}

$url = ($radek.Line -split '=', 2)[1].Trim().Trim('"').Trim("'")

# --- 3. kam to uložit -------------------------------------------------------
$slozka = Join-Path (Split-Path $PSScriptRoot -Parent) "zalohy-autoskola"
if (-not (Test-Path $slozka)) {
    New-Item -ItemType Directory -Path $slozka | Out-Null
}

$nazev = "autoskola-" + (Get-Date -Format "yyyy-MM-dd-HHmm") + ".dump"
$cil   = Join-Path $slozka $nazev

# --- 4. zálohuj -------------------------------------------------------------
Write-Host "Zálohuji pomocí pg_dump $verze ..." -ForegroundColor Cyan

# -Fc = komprimovaný formát, ze kterého umí pg_restore obnovit i jednotlivé tabulky
& $pgDump -Fc --no-owner --no-privileges -d $url -f $cil

if ($LASTEXITCODE -ne 0) {
    Write-Host "pg_dump skončil chybou. Záloha NEVZNIKLA." -ForegroundColor Red
    exit 1
}

# --- 5. ověř, že to není prázdný soubor -------------------------------------
$soubor = Get-Item $cil
if ($soubor.Length -lt 1024) {
    Write-Host "Soubor vznikl, ale je podezřele malý ($($soubor.Length) B). Zkontroluj to." -ForegroundColor Yellow
    exit 1
}

$kb = [math]::Round($soubor.Length / 1KB, 1)
Write-Host "Hotovo: $nazev ($kb kB)" -ForegroundColor Green
Write-Host "Uloženo v: $slozka" -ForegroundColor Gray

# --- 6. přehled ------------------------------------------------------------
$vsechny = Get-ChildItem $slozka -Filter "*.dump" | Sort-Object LastWriteTime -Descending
Write-Host ""
Write-Host "Zálohy, které máš ($($vsechny.Count)):" -ForegroundColor Gray
$vsechny | Select-Object -First 5 | ForEach-Object {
    "{0,-40} {1,8:N1} kB   {2}" -f $_.Name, ($_.Length / 1KB), $_.LastWriteTime.ToString("d.M.yyyy HH:mm")
}
if ($vsechny.Count -gt 5) { Write-Host "... a další $($vsechny.Count - 5)" -ForegroundColor DarkGray }
