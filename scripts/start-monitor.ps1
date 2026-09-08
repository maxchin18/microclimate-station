. "$PSScriptRoot/common.ps1"
$Url = 'http://127.0.0.1:8765'
$Running = $false
try {
    $State = Invoke-RestMethod "$Url/api/state" -TimeoutSec 2
    $Running = ($null -ne $State.status -and $null -ne $State.history)
} catch {}
if (-not $Running) {
    $MonitorProcess = Start-Process -FilePath $Python -ArgumentList @(('"{0}"' -f (Join-Path $ProjectRoot 'monitor.py'))) -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Runtime 'monitor.log') -RedirectStandardError (Join-Path $Runtime 'monitor-error.log') -PassThru
    $MonitorProcess.Id | Set-Content -LiteralPath (Join-Path $Runtime 'monitor.pid')
    $Ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 300
        try { $State = Invoke-RestMethod "$Url/api/state" -TimeoutSec 1; $Ready = $true; break } catch {}
    }
    if (-not $Ready) { throw 'Monitor did not start. See .runtime/monitor-error.log.' }
}
Start-Process $Url
Write-Output "Monitor: $Url"
