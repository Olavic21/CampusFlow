# Prepare .env frontend pour build APK (copie .env.apk + option IP LAN)
param(
    [string]$LanIp = "",
    [switch]$DetectIp
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Frontend = Join-Path $Root "frontend"
$ApkEnv = Join-Path $Frontend ".env.apk"
$Target = Join-Path $Frontend ".env"

if (-not (Test-Path $ApkEnv)) {
    Write-Host "Fichier introuvable : $ApkEnv" -ForegroundColor Red
    exit 1
}

$content = Get-Content $ApkEnv -Raw

if ($DetectIp -and -not $LanIp) {
    $rows = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        ForEach-Object {
            $alias = (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Name
            if (-not $alias) { $alias = "if$($_.InterfaceIndex)" }
            $kind = if ($alias -match 'Wi-?Fi|WLAN|Wireless') { 0 }
                    elseif ($alias -match 'Ethernet|eth' -and $alias -notmatch 'Virtual|VMware|VirtualBox|vEthernet|Host-Only') { 1 }
                    else { 2 }
            [PSCustomObject]@{ IP = $_.IPAddress; Alias = $alias; Kind = $kind }
        } |
        Sort-Object Kind, Alias

    $pick = $rows | Select-Object -First 1
    if ($pick) {
        $LanIp = $pick.IP
        Write-Host "IP LAN detectee : $LanIp ($($pick.Alias))" -ForegroundColor Green
        $others = $rows | Select-Object -Skip 1
        if ($others) {
            Write-Host "Autres interfaces :" -ForegroundColor DarkGray
            $others | ForEach-Object { Write-Host "  $($_.IP) ($($_.Alias))" -ForegroundColor DarkGray }
        }
    }
}

if ($LanIp -and $LanIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
    Write-Host "IP invalide ignoree : $LanIp" -ForegroundColor Yellow
    $LanIp = ""
}

if ($LanIp) {
    $content = $content -replace 'http://[^\s#]+:8000', "http://${LanIp}:8000"
    $content = $content -replace 'ws://[^\s#]+:8000', "ws://${LanIp}:8000"
}

Set-Content -Path $Target -Value $content.TrimEnd() -Encoding UTF8
Write-Host "OK $Target mis a jour depuis .env.apk" -ForegroundColor Green
if ($LanIp) {
    $backendUrl = "http://${LanIp}:8000"
    Write-Host "  Backend attendu : $backendUrl" -ForegroundColor Cyan
    Write-Host "  Lancez : .\scripts\restart-backend.ps1 -Lan" -ForegroundColor Cyan
}

exit 0
