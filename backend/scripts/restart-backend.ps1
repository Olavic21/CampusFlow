# Redirige vers le script racine (utilisable depuis backend/)
param(
    [switch]$Lan
)

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$rootScript = Join-Path $projectRoot "scripts\restart-backend.ps1"

if (-not (Test-Path $rootScript)) {
    Write-Error "Script introuvable : $rootScript"
    exit 1
}

& $rootScript @PSBoundParameters
