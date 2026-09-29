# Рендер ролика + мастеринг звука под соцсети (-14 LUFS, пики не выше -1.5 dBTP)
# .\scripts\render.ps1 -Comp HearthPulseAd -Out hearthpulse-9x16
# .\scripts\render.ps1 -Out hearthpulse-9x16 -MasterOnly   — только пересвести звук готового файла
param([string]$Comp = 'HearthPulseAd', [string]$Out = 'hearthpulse-9x16', [switch]$MasterOnly)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$raw = "out\$Out-raw.mp4"
if ($MasterOnly) {
  Move-Item "out\$Out.mp4" $raw -Force
} else {
  npx remotion render $Comp $raw --browser-executable="C:/Program Files/Google/Chrome/Application/chrome.exe" --codec=h264 --crf=18 2>&1 | Select-Object -Last 2
}

# Двухпроходная нормализация: замер, затем точная линейная коррекция
$target = 'I=-14:TP=-1.5:LRA=11'
$json = (ffmpeg -hide_banner -i $raw -af "loudnorm=${target}:print_format=json" -f null - 2>&1 | Out-String)
$m = ($json.Substring($json.LastIndexOf('{')) -replace '(?s)\}.*', '}') | ConvertFrom-Json
$af = "loudnorm=${target}:measured_I=$($m.input_i):measured_TP=$($m.input_tp):measured_LRA=$($m.input_lra):measured_thresh=$($m.input_thresh):offset=$($m.target_offset):linear=true"
ffmpeg -y -loglevel error -i $raw -c:v copy -af $af -c:a aac -b:a 256k -ar 48000 -shortest "out\$Out.mp4"
ffmpeg -hide_banner -i "out\$Out.mp4" -af ebur128=peak=true -f null - 2>&1 | Select-String -Pattern '^\s+I:|^\s+Peak:' | Select-Object -Last 2
Remove-Item $raw
"out\$Out.mp4"
