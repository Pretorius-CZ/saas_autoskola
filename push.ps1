# push.ps1 - jeden prikaz misto ctyr
#
# Pouziti:
#   .\push.ps1 "co jsem zmenil"
#
# Kdyz popis nenapises, doplni se datum a cas.
# Kdyz neni co commitovat, skript to jen oznami a skonci.
#
# Pred odeslanim se projekt cele sestavi. Trva to minutu az dve, ale
# chyta to vsechno, co by shodilo build na Vercelu - vcetne pravidel
# Next.js, na ktera typova kontrola nestaci (napriklad ze soubor
# "use server" smi vyvazet jen asynchronni funkce).
#
# Stavi se do slozky .next-kontrola, ne do .next. Bezici dev server tak
# zustane nedotceny a nemusis ho kvuli pushi vypinat.
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

Write-Host "Sestavuji projekt pro kontrolu (minutu az dve)..." -ForegroundColor Cyan

# Kolem ciziho programu se "Stop" vypina zamerne. Kdyz npm nebo next
# napise cokoli na chybovy vystup, PowerShell by skript ukoncil driv,
# nez se stihne precist navratovy kod - a vypadalo by to, jako by se
# nestalo nic. Rozhoduje vyhradne navratovy kod.
$ErrorActionPreference = "Continue"
$env:BUILD_KONTROLA = "1"
npm run build
$sestaveni = $LASTEXITCODE
Remove-Item Env:\BUILD_KONTROLA -ErrorAction SilentlyContinue
$ErrorActionPreference = "Stop"

if ($sestaveni -ne 0) {
    Write-Host ""
    Write-Host "Sestaveni neproslo - neposilam nic." -ForegroundColor Red
    Write-Host "Oprav chyby vypsane vyse a pust prikaz znovu." -ForegroundColor Red
    exit 1
}

Write-Host "Sestaveni proslo." -ForegroundColor Green

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
