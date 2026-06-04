# Installe les dependances Python du backend (a lancer une fois si erreur bcrypt)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }
$req = Join-Path $root "requirements.txt"

Write-Host "Python : $python"
& $python -m pip install --upgrade pip
& $python -m pip install -r $req
& $python -c "import bcrypt; print('bcrypt OK')"
