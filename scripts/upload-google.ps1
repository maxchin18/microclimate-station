param([string]$Port)
. "$PSScriptRoot/common.ps1"
$CloudSketch = Join-Path $ProjectRoot 'firmware/dht_google_upload'
$CloudBuild = Join-Path $ToolsConfig.buildRoot 'dht-google-upload'
$Secrets = Join-Path $CloudSketch 'secrets.local.h'
if (-not (Test-Path -LiteralPath $Secrets)) { throw 'Missing secrets.local.h.' }
if (-not $Port) {
    $Detected = & $Python -c 'import serial.tools.list_ports as p; print(chr(10).join(x.device for x in p.comports() if x.vid in (0x1a86,0x10c4,0x0403)))'
    if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate serial ports.' }
    $Candidates = @($Detected | Where-Object { $_ -match '^COM[0-9]+$' })
    if ($Candidates.Count -ne 1) { throw 'Connect one USB board, or provide -Port COM3.' }
    $Port = $Candidates[0]
}
& $Cli compile --config-file $Config --fqbn $Fqbn --build-path $CloudBuild $CloudSketch
if ($LASTEXITCODE -ne 0) { throw 'Cloud firmware compilation failed.' }
$PauseFile = Join-Path $Runtime 'uploading'
try {
    New-Item -ItemType File -Force -Path $PauseFile | Out-Null
    Start-Sleep -Seconds 3
    & $Cli upload --config-file $Config --fqbn $Fqbn --port $Port --input-dir $CloudBuild $CloudSketch
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed. Check USB cable and serial port.' }
} finally {
    Remove-Item -LiteralPath $PauseFile -Force -ErrorAction SilentlyContinue
}
Write-Output 'Cloud firmware uploaded. Connect D0 to RST for timed wake-up.'
