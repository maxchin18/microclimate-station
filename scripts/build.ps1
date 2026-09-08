. "$PSScriptRoot/common.ps1"
& $Cli compile --config-file $Config --fqbn $Fqbn --build-path $Build $Sketch
if ($LASTEXITCODE -ne 0) { throw 'Firmware compilation failed.' }
