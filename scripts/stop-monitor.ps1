. "$PSScriptRoot/common.ps1"
$MonitorPath = Join-Path $ProjectRoot 'monitor.py'
$Processes = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('python.exe', 'pythonw.exe') -and $_.CommandLine -and $_.CommandLine.Contains($MonitorPath)
}
foreach ($MonitorProcess in $Processes) {
    Stop-Process -Id $MonitorProcess.ProcessId -ErrorAction SilentlyContinue
}
Write-Output 'Monitor stopped.'
