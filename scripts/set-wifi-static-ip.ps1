# Fixe l'adresse IPv4 Wi-Fi du PC (evite les changements DHCP)
# Usage (PowerShell admin) :
#   .\scripts\set-wifi-static-ip.ps1
#   .\scripts\set-wifi-static-ip.ps1 -Ip 10.94.13.27 -Gateway 10.94.13.240

param(
    [string]$AdapterName = "Wi-Fi",
    [string]$Ip = "10.94.13.27",
    [int]$PrefixLength = 24,
    [string]$Gateway = "10.94.13.240",
    [string[]]$Dns = @()
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Ce script doit etre lance en administrateur." -ForegroundColor Red
    Write-Host '  Clic droit PowerShell -> Executer en tant qu''administrateur' -ForegroundColor Yellow
    exit 1
}

$adapter = Get-NetAdapter -Name $AdapterName -ErrorAction SilentlyContinue
if (-not $adapter) {
    $adapter = Get-NetAdapter | Where-Object { $_.Name -match 'Wi-?Fi|WLAN|Wireless' } | Select-Object -First 1
}
if (-not $adapter) {
    Write-Host "Adaptateur Wi-Fi introuvable." -ForegroundColor Red
    exit 1
}

if (-not $Dns -or $Dns.Count -eq 0) {
    $Dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
    if (-not $Dns -or $Dns.Count -eq 0) { $Dns = @($Gateway, "8.8.8.8") }
}

Write-Host "Configuration IP statique sur $($adapter.Name) (ifIndex $($adapter.ifIndex))" -ForegroundColor Cyan
Write-Host "  IP      : $Ip/$PrefixLength"
Write-Host "  Gateway : $Gateway"
Write-Host "  DNS     : $($Dns -join ', ')"

Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue

Get-NetRoute -InterfaceIndex $adapter.ifIndex -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue

New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $Ip -PrefixLength $PrefixLength -DefaultGateway $Gateway | Out-Null
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses $Dns

Write-Host ""
Write-Host "Wi-Fi configure en IP statique : $Ip" -ForegroundColor Green
Write-Host "Mettez a jour l'APK si besoin :" -ForegroundColor Cyan
Write-Host "  .\scripts\prepare-apk-env.ps1 -LanIp $Ip"
Write-Host "  .\scripts\build-apk-cli.ps1 -LanIp $Ip"
