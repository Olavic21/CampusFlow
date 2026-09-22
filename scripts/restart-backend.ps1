# Redémarre l'API CampusFlow (libère le port 8000 puis relance uvicorn)
param(
    [switch]$Lan
)

$port = 8000
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$hostBind = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }

Write-Host "Recherche de processus sur le port $port..."
Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object {
        $procId = $_.OwningProcess
        if ($procId -and $procId -ne 0) {
            Write-Host "Arret du processus PID $procId"
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }

Start-Sleep -Seconds 2

$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }

Write-Host "Verification des dependances..."
$check = & $python -c "import bcrypt" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installation des dependances..."
    $req = Join-Path $root "requirements.txt"
    & $python -m pip install bcrypt email-validator "python-jose[cryptography]" 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0 -and (Test-Path $req)) {
        & $python -m pip install -r $req 2>&1 | ForEach-Object { Write-Host $_ }
    }
} else {
    Write-Host "Dependances OK."
}

Set-Location (Join-Path $root "backend")
if ($Lan) {
    Write-Host "Demarrage API LAN : http://0.0.0.0:$port (accessible depuis le telephone)" -ForegroundColor Green
    Write-Host "Verifiez CORS_ORIGINS dans backend\.env (https://localhost inclus par defaut)"
    $showIps = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\show-lan-ips.ps1"
    if (Test-Path $showIps) { & $showIps }
    Write-Host "Si le telephone ne repond pas : pare-feu Windows (admin) :" -ForegroundColor Yellow
    Write-Host "  .\scripts\open-backend-firewall.ps1" -ForegroundColor Cyan
} else {
    Write-Host "Demarrage API locale : http://127.0.0.1:$port"
}
Write-Host "Arret : Ctrl+C"
& $python -m uvicorn app.main:app --reload --host $hostBind --port $port
