# Installe le SDK Android (sans Android Studio) pour builder l'APK CampusFlow
# Usage : .\scripts\install-android-sdk.ps1
# Prérequis : le zip "commandlinetools-win-*.zip" dans le dossier Téléchargements

$ErrorActionPreference = "Stop"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$latest = Join-Path $sdk "cmdline-tools\latest"
$sdkmanager = Join-Path $latest "bin\sdkmanager.bat"

Write-Host "`n==> Vérification SDK Android" -ForegroundColor Cyan

if (Test-Path $sdkmanager) {
    Write-Host "sdkmanager déjà présent : $sdkmanager" -ForegroundColor Green
} else {
    $zip = Get-ChildItem "$env:USERPROFILE\Downloads\commandlinetools-win*.zip" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $zip) {
        Write-Host @"

Fichier introuvable : commandlinetools-win-*.zip dans Téléchargements.

1. Téléchargez "Command line tools only" (Windows) :
   https://developer.android.com/studio#command-line-tools-only

2. Placez le zip dans : $env:USERPROFILE\Downloads

3. Relancez : .\scripts\install-android-sdk.ps1

"@ -ForegroundColor Yellow
        exit 1
    }

    Write-Host "Extraction de $($zip.Name)..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $latest | Out-Null
    $tmp = Join-Path $env:TEMP "android-cmdtools-$(Get-Random)"
    Expand-Archive -Path $zip.FullName -DestinationPath $tmp -Force

    $inner = Join-Path $tmp "cmdline-tools"
    if (Test-Path $inner) {
        Copy-Item -Path "$inner\*" -Destination $latest -Recurse -Force
    } else {
        Copy-Item -Path "$tmp\*" -Destination $latest -Recurse -Force
    }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $sdkmanager)) {
        Write-Host "Échec : sdkmanager introuvable après extraction." -ForegroundColor Red
        Write-Host "Attendu : $sdkmanager"
        exit 1
    }
    Write-Host "sdkmanager installé." -ForegroundColor Green
}

$env:ANDROID_HOME = $sdk
$env:Path = "$latest\bin;$sdk\platform-tools;$env:Path"

Write-Host "`n==> Acceptation des licences Android" -ForegroundColor Cyan
Write-Host "(tapez y puis Entrée pour chaque licence)`n"
& $sdkmanager --licenses

Write-Host "`n==> Installation platform-tools, android-35, build-tools" -ForegroundColor Cyan
& $sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

Write-Host ""
Write-Host "SDK Android pret." -ForegroundColor Green
Write-Host "  ANDROID_HOME = $sdk"
Write-Host ""
Write-Host "Pour builder l APK :" -ForegroundColor Green
Write-Host "  cd $((Split-Path $PSScriptRoot -Parent))"
Write-Host "  .\scripts\build-apk-cli.ps1 -DetectIp"