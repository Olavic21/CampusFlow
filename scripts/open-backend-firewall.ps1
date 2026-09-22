# Ouvre le port 8000 dans le pare-feu Windows pour l'APK / telephone
# Usage (PowerShell admin) : .\scripts\open-backend-firewall.ps1

$ErrorActionPreference = "Stop"
$ruleName = "CampusFlow Backend 8000"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Ce script doit etre lance en administrateur." -ForegroundColor Red
    Write-Host "Clic droit PowerShell -> Executer en tant qu'administrateur, puis :" -ForegroundColor Yellow
    Write-Host '  cd "C:\Users\HP PROBOOK 450 G2\CampusFlow"' -ForegroundColor Cyan
    Write-Host "  .\scripts\open-backend-firewall.ps1" -ForegroundColor Cyan
    exit 1
}

$existing = netsh advfirewall firewall show rule name="$ruleName" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Regle pare-feu deja presente : $ruleName" -ForegroundColor Green
} else {
    netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=8000 profile=private,public
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Regle pare-feu ajoutee : TCP 8000 entrant (profils private, public)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Testez depuis le navigateur du telephone :" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "show-lan-ips.ps1")
