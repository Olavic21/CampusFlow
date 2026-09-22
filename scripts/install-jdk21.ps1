# Installe JDK 21 (Temurin) pour le build Gradle Android
# Usage : .\scripts\install-jdk21.ps1
# Gradle/Capacitor : Java 17-24 requis (Java 25 non supporte)

$ErrorActionPreference = "Stop"

function Find-Jdk21 {
    $roots = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java",
        "C:\Program Files\Microsoft",
        "$env:LOCALAPPDATA\Programs\Eclipse Adoptium"
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $release = Join-Path $_.FullName "release"
            $javaExe = Join-Path $_.FullName "bin\java.exe"
            if ((Test-Path $release) -and (Test-Path $javaExe)) {
                $text = Get-Content $release -Raw
                if ($text -match 'JAVA_VERSION="21') { return $_.FullName }
            }
        }
    }
    return $null
}

$existing = Find-Jdk21
if ($existing) {
    Write-Host "JDK 21 deja present : $existing" -ForegroundColor Green
    Write-Host "Relancez : .\scripts\build-apk-cli.ps1 -DetectIp" -ForegroundColor Cyan
    exit 0
}

Write-Host "`n==> Installation JDK 21 (Eclipse Temurin)" -ForegroundColor Cyan
Write-Host "Gradle Android ne supporte pas encore Java 25." -ForegroundColor Yellow

$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
    Write-Host "Tentative via winget..." -ForegroundColor Cyan
    & winget install EclipseAdoptium.Temurin.21.JDK --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
        $existing = Find-Jdk21
        if ($existing) {
            Write-Host "`nJDK 21 installe : $existing" -ForegroundColor Green
            Write-Host "Relancez : .\scripts\build-apk-cli.ps1 -DetectIp" -ForegroundColor Cyan
            exit 0
        }
    }
    Write-Host "winget a echoue ou JDK introuvable apres installation." -ForegroundColor Yellow
}

Write-Host @"

Installation manuelle :

1. Telechargez Temurin JDK 21 (Windows x64) :
   https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk

2. Installez avec les options par defaut.

3. Relancez :
   .\scripts\build-apk-cli.ps1 -DetectIp

Le script de build detectera automatiquement JDK 21.

"@ -ForegroundColor Yellow
exit 1
