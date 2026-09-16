# push.ps1 - jeden prikaz misto tri
#
# Pouziti:
#   .\push.ps1 "co jsem zmenil"
#
# Kdyz popis nenapises, doplni se datum a cas.
# Kdyz neni co commitovat, skript to jen oznami a skonci.
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
