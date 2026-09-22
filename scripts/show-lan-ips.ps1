# Affiche les IP LAN du PC et l'URL de test backend
$ErrorActionPreference = "SilentlyContinue"

function Get-PreferredLanIps {
    $rows = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        ForEach-Object {
            $alias = (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Name
            if (-not $alias) { $alias = "if$($_.InterfaceIndex)" }
            [PSCustomObject]@{
                IP = $_.IPAddress
                Alias = $alias
                Kind = if ($alias -match 'Ethernet|eth' -and $alias -notmatch 'Virtual|VMware|VirtualBox|vEthernet|Host-Only') { 'ethernet' }
                       elseif ($alias -match 'Wi-?Fi|WLAN|Wireless') { 'wifi' }
                       else { 'other' }
            }
        }

    $ordered = @()
    $ordered += $rows | Where-Object Kind -eq 'wifi'
    $ordered += $rows | Where-Object Kind -eq 'ethernet'
    $ordered += $rows | Where-Object Kind -eq 'other'
    return $ordered
}

$ips = Get-PreferredLanIps
if (-not $ips) {
    Write-Host "Aucune IP LAN detectee." -ForegroundColor Yellow
    exit 1
}

Write-Host "IP LAN de ce PC :" -ForegroundColor Cyan
foreach ($row in $ips) {
    $tag = switch ($row.Kind) { 'ethernet' { '[Ethernet]' } 'wifi' { '[Wi-Fi]' } default { '' } }
    Write-Host "  $tag $($row.IP)  ($($row.Alias))"
}

$primary = ($ips | Select-Object -First 1).IP
Write-Host ""
Write-Host "URL backend pour l'APK (Wi-Fi prioritaire) :" -ForegroundColor Green
Write-Host "  http://${primary}:8000"
Write-Host ""
Write-Host "Test telephone (navigateur) :" -ForegroundColor Green
Write-Host "  http://${primary}:8000/health"
Write-Host "  Reponse attendue : {""status"":""ok""}"
