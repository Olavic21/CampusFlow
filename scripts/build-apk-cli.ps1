# Build APK CampusFlow Lite — sans Android Studio
# Usage :
#   .\scripts\build-apk-cli.ps1              # env APK + sync + build
#   .\scripts\build-apk-cli.ps1 -DetectIp    # détecte l'IP LAN automatiquement
#   .\scripts\build-apk-cli.ps1 -SkipSync    # build Gradle uniquement

param(
    [switch]$DetectIp,
    [string]$LanIp = "",
    [switch]$SkipSync,
    [string]$JavaHome = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AndroidDir = Join-Path $Root "frontend\android"
$FrontendDir = Join-Path $Root "frontend"
$SdkDefault = Join-Path $env:LOCALAPPDATA "Android\Sdk"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

function Get-JdkMajorVersion([string]$JdkPath) {
    $release = Join-Path $JdkPath "release"
    if (-not (Test-Path $release)) { return $null }
    $text = Get-Content $release -Raw
    if ($text -match 'JAVA_VERSION="(\d+)') { return [int]$Matches[1] }
    return $null
}

function Find-CompatibleJdk {
    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($env:JAVA_HOME) { $candidates.Add($env:JAVA_HOME) }

    $searchRoots = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Java",
        "C:\Program Files\Microsoft",
        "C:\Program Files\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Eclipse Adoptium"
    )

    foreach ($root in $searchRoots) {
        if (-not (Test-Path $root)) { continue }
        $javaExe = Join-Path $root "bin\java.exe"
        if (Test-Path $javaExe) { $candidates.Add($root) }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $nestedJava = Join-Path $_.FullName "bin\java.exe"
            if (Test-Path $nestedJava) { $candidates.Add($_.FullName) }
        }
    }

    $best = $null
    $bestMajor = -1
    foreach ($jdk in ($candidates | Select-Object -Unique)) {
        $major = Get-JdkMajorVersion $jdk
        if ($null -eq $major) { continue }
        if ($major -ge 17 -and $major -le 24 -and $major -gt $bestMajor) {
            $best = $jdk
            $bestMajor = $major
        }
    }
    return $best
}

function Use-Jdk([string]$JdkPath) {
    $javaBin = Join-Path $JdkPath "bin"
    if (-not (Test-Path (Join-Path $javaBin "java.exe"))) {
        Write-Host "JDK invalide : $JdkPath" -ForegroundColor Red
        exit 1
    }
    $env:JAVA_HOME = $JdkPath
    $env:Path = "$javaBin;$env:Path"
}

Write-Step "Preparation environnement APK"
$prepParams = @{}
if ($DetectIp) { $prepParams.DetectIp = $true }
if ($LanIp) { $prepParams.LanIp = $LanIp }
& (Join-Path $PSScriptRoot "prepare-apk-env.ps1") @prepParams
if (-not $?) { exit 1 }

Write-Step "Verification Java (Gradle : JDK 17-24, pas Java 25)"
$jdkPath = $null
if ($JavaHome) {
    $jdkPath = $JavaHome
} else {
    $jdkPath = Find-CompatibleJdk
}

if ($jdkPath) {
    Use-Jdk $jdkPath
    $major = Get-JdkMajorVersion $jdkPath
    Write-Host "JDK $major : $jdkPath" -ForegroundColor Green
} else {
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $javaVer = & java -version 2>&1 | Select-Object -First 1
        $ErrorActionPreference = $prevEap
        if ($javaVer -match 'version "25') {
            Write-Host $javaVer -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Java 25 n'est pas compatible avec Gradle Android." -ForegroundColor Red
            Write-Host "Installez JDK 21 puis relancez :" -ForegroundColor Yellow
            Write-Host "  .\scripts\install-jdk21.ps1" -ForegroundColor Cyan
            Write-Host "Ou : https://adoptium.net/temurin/releases/?version=21" -ForegroundColor Yellow
            exit 1
        }
        Write-Host $javaVer -ForegroundColor Green
    } else {
        Write-Host "Java non trouve dans le PATH." -ForegroundColor Red
        Write-Host "Installez JDK 21 : .\scripts\install-jdk21.ps1" -ForegroundColor Yellow
        exit 1
    }
}

$sdk = $env:ANDROID_HOME
if (-not $sdk -and (Test-Path $SdkDefault)) { $sdk = $SdkDefault }
if (-not $sdk) {
    Write-Host @"

Android SDK introuvable.

1. Téléchargez "Command line tools only" (Windows) :
   https://developer.android.com/studio#command-line-tools-only

2. Extrayez dans : $SdkDefault\cmdline-tools\latest\

3. Installez :
   sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

4. Relancez ce script.

"@ -ForegroundColor Yellow
    exit 1
}

Write-Host "SDK : $sdk" -ForegroundColor Green

$localProps = Join-Path $AndroidDir "local.properties"
$sdkForward = $sdk -replace '\\', '/'
$localContent = "sdk.dir=$sdkForward`n"
[System.IO.File]::WriteAllText($localProps, $localContent)
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Write-Step "local.properties cree ($sdkForward)"

if (-not $SkipSync) {
    Write-Step "Build frontend + cap sync (Vite + Capacitor)"
    Push-Location $FrontendDir
    npm run cap:sync
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        exit $LASTEXITCODE
    }
    Pop-Location
}

Write-Step "Compilation APK (5-20 min la 1ere fois, telechargement Gradle)"
Push-Location $AndroidDir
$env:GRADLE_OPTS = "-Dorg.gradle.daemon=true -Dorg.gradle.internal.http.connectionTimeout=300000 -Dorg.gradle.internal.http.socketTimeout=300000"
$maxAttempts = 3
$code = 1
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    if ($attempt -gt 1) {
        Write-Host "Nouvelle tentative Gradle ($attempt/$maxAttempts)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    & .\gradlew.bat assembleDebug --no-daemon
    $code = $LASTEXITCODE
    if ($code -eq 0) { break }
}
Pop-Location

if ($code -ne 0) {
    Write-Host "Echec du build Gradle." -ForegroundColor Red
    Write-Host "Causes frequentes :" -ForegroundColor Yellow
    Write-Host "  - Java 25 : installez JDK 21 avec .\scripts\install-jdk21.ps1" -ForegroundColor Yellow
    Write-Host "  - Timeout reseau : relancez .\scripts\build-apk-cli.ps1 -DetectIp -SkipSync" -ForegroundColor Yellow
    exit $code
}

$apk = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
$dest = Join-Path $Root "CampusFlow-lite-debug.apk"
if (Test-Path $apk) {
    Copy-Item $apk $dest -Force
    Write-Host "`nAPK genere :" -ForegroundColor Green
    Write-Host "  $apk"
    Write-Host "  Copie : $dest"
    Write-Host ""
    Write-Host "Prochaines etapes :" -ForegroundColor Cyan
    Write-Host "  1. Backend sur le reseau local : .\scripts\restart-backend.ps1 -Lan"
    Write-Host "  2. Telephone + PC sur le meme Wi-Fi / Ethernet"
    Write-Host "  3. Installer le fichier APK sur le telephone"
} else {
    Write-Host "Build termine mais APK introuvable." -ForegroundColor Yellow
}
