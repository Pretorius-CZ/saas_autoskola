# push.ps1 - jeden prikaz misto ctyr
#
# Pouziti:
#   .\push.ps1 "co jsem zmenil"
#
# Kdyz popis nenapises, doplni se datum a cas.
# Kdyz neni co commitovat, skript to jen oznami a skonci.
#
# Pred odeslanim se pusti typova kontrola. Kdyz neprojde, NIC se
# neposle: build na Vercelu by na tychze chybach spadl, jen o par
# minut pozdeji a s horsim vypisem.
#
# POZOR: tento soubor je zamerne bez diakritiky. Windows PowerShell 5.1
# cte skripty v ceskem kodovani a na UTF-8 diakritice se rozsype.

param(
    [Parameter(Position = 0)]
    [string]$Zprava
)

$ErrorActionPreference = "Stop"

# pracuj vzdy ve slozce, kde skript lezi - ne tam, odkud ho pustis
Set-Location -Path $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Zprava)) {
    $Zprava = "prubezna zmena " + (Get-Date -Format "d.M.yyyy HH:mm")
}

Write-Host "Kontroluji typy..." -ForegroundColor Cyan

# Kolem ciziho programu se "Stop" vypina zamerne. Kdyz tsc nebo npx
# napise cokoli na chybovy vystup, PowerShell by skript ukoncil driv,
# nez se stihne precist navratovy kod - a vypadalo by to, jako by se
# nestalo nic.
$ErrorActionPreference = "Continue"
npx tsc --noEmit
$typy = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($typy -ne 0) {
    Write-Host ""
    Write-Host "Typova kontrola neprosla - neposilam nic." -ForegroundColor Red
    Write-Host "Oprav chyby vypsane vyse a pust prikaz znovu." -ForegroundColor Red
    exit 1
}

Write-Host "Typy v poradku." -ForegroundColor Green

git add -A

# --quiet vrati nenulovy kod, kdyz jsou zmeny pripravene k commitu
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nic se nezmenilo, neni co commitovat." -ForegroundColor Yellow
    exit 0
}

Write-Host "Commituji: $Zprava" -ForegroundColor Cyan
git commit -m $Zprava

Write-Host "Posilam na GitHub..." -ForegroundColor Cyan
git push

Write-Host "Hotovo." -ForegroundColor Green
