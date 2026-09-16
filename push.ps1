# push.ps1 — jeden příkaz místo tří
#
# Použití:
#   .\push.ps1 "co jsem změnil"
#
# Když popis nenapíšeš, doplní se datum a čas.
# Když není co commitovat, skript to jen oznámí a skončí.

param(
    [Parameter(Position = 0)]
    [string]$Zprava
)

$ErrorActionPreference = "Stop"

# pracuj vždy ve složce, kde skript leží — ne tam, odkud ho pustíš
Set-Location -Path $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Zprava)) {
    $Zprava = "průběžná změna " + (Get-Date -Format "d.M.yyyy HH:mm")
}

git add -A

# --quiet vrátí nenulový kód, když jsou změny připravené k commitu
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nic se nezměnilo, není co commitovat." -ForegroundColor Yellow
    exit 0
}

Write-Host "Commituju: $Zprava" -ForegroundColor Cyan
git commit -m $Zprava

Write-Host "Posílám na GitHub..." -ForegroundColor Cyan
git push

Write-Host "Hotovo." -ForegroundColor Green
