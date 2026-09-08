param([string]$Port)
. "$PSScriptRoot/common.ps1"
if (-not $Port) {
    $Detected = & $Python -c 'import serial.tools.list_ports as p; print(chr(10).join(x.device for x in p.comports() if x.vid in (0x1a86,0x10c4,0x0403)))'
    if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate serial ports.' }
    $Candidates = @($Detected | Where-Object { $_ -match '^COM[0-9]+$' })
    if ($Candidates.Count -ne 1) { throw 'Connect one USB board, or run: ./scripts/upload.ps1 -Port COM3' }
    $Port = $Candidates[0]
}
& "$PSScriptRoot/build.ps1"
$PauseFile = Join-Path $Runtime 'uploading'
try {
    New-Item -ItemType File -Force -Path $PauseFile | Out-Null
    Start-Sleep -Seconds 3
    & $Cli upload --config-file $Config --fqbn $Fqbn --port $Port --input-dir $Build $Sketch
    if ($LASTEXITCODE -ne 0) { throw 'Upload failed. Check USB cable and serial port.' }
} finally {
    Remove-Item -LiteralPath $PauseFile -Force -ErrorAction SilentlyContinue
}
