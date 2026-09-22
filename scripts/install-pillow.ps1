# Installe Pillow dans le virtualenv du frontend si necessaire
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }

Write-Host "Python : $python"
& $python -m pip install --quiet --upgrade "pillow>=10.1.0"
& $python -c "from PIL import Image; print('Pillow OK', Image.__version__)"
