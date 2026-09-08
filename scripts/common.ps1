$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Runtime = Join-Path $ProjectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
$ToolsConfig = Get-Content -LiteralPath (Join-Path $ProjectRoot 'tools.local.json') -Raw | ConvertFrom-Json
$Cli = $ToolsConfig.cli
$Python = $ToolsConfig.python
$Config = Join-Path $ProjectRoot 'arduino-cli.yaml'
$Sketch = Join-Path $ProjectRoot 'firmware/dht_monitor'
$Build = Join-Path $ToolsConfig.buildRoot 'dht-monitor'
$Fqbn = 'esp8266:esp8266:nodemcuv2'
