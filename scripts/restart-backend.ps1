# Redemarre l'API CampusFlow (libere le port 8000 puis relance uvicorn)
$port = 8000
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

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

# Verifier bcrypt sans faire echouer le script (pip ecrit souvent sur stderr)
Write-Host "Verification des dependances..."
$check = & $python -c "import bcrypt" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installation des dependances (bcrypt, python-jose, email-validator)..."
    $req = Join-Path $root "requirements.txt"
    & $python -m pip install bcrypt email-validator "python-jose[cryptography]" 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0 -and (Test-Path $req)) {
        Write-Host "Installation depuis requirements.txt..."
        & $python -m pip install -r $req 2>&1 | ForEach-Object { Write-Host $_ }
    }
} else {
    Write-Host "Dependances OK (bcrypt present)."
}

Set-Location (Join-Path $root "backend")
Write-Host "Demarrage de l'API sur http://127.0.0.1:$port ..."
Write-Host "Arret : Ctrl+C"
& $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $port
