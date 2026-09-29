# Генерирует музыку и звуковые эффекты в Higgsfield и скачивает их в public/audio
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$out = Join-Path $root 'public\audio'
New-Item -ItemType Directory -Force $out | Out-Null

function Get-Result($lines) {
  ($lines | Where-Object { $_ -match '^https?://' } | Select-Object -Last 1)
}
function Save-Job($name, $argsList) {
  $lines = & higgsfield generate create @argsList --wait --wait-timeout 20m 2>&1 | ForEach-Object { "$_" }
  $url = Get-Result $lines
  if ($url) {
    $ext = [IO.Path]::GetExtension(([Uri]$url).AbsolutePath)
    Invoke-WebRequest $url -OutFile (Join-Path $out "$name$ext")
    "$name OK $url"
  } else {
    "$name FAIL: $($lines -join ' | ')"
  }
}

Save-Job 'music' @('sonilo_music', '--duration', '30', '--prompt',
  'Epic fantasy tavern trailer music, 30 seconds, instrumental. Opens with tense low strings and a deep taiko hit, at 3 seconds a bright brass and choir impact, then driving celtic tavern rhythm with fiddle, lute, frame drums and staccato strings at 120 BPM, energy rising scene by scene, big triumphant final chord at 26 seconds that rings out to the end. Warm, heroic, playful, no vocals.')

Save-Job 'sfx-whoosh' @('seed_audio', '--sample_rate', '48000', '--prompt',
  'Sound effect only: fast magical whoosh of playing cards flying past the camera, paper flutter and airy swish, short and punchy, no music, no voice.')
Save-Job 'sfx-heartbeat' @('seed_audio', '--sample_rate', '48000', '--prompt',
  'Sound effect only: one deep cinematic heartbeat thump with a bright electronic ECG monitor beep and a short shimmering tail, punchy, no music, no voice.')
Save-Job 'sfx-flip' @('seed_audio', '--sample_rate', '48000', '--prompt',
  'Sound effect only: a single thick playing card flipping over with a crisp snap and a soft magical sparkle, very short, no music, no voice.')
Save-Job 'sfx-pop' @('seed_audio', '--sample_rate', '48000', '--prompt',
  'Sound effect only: soft wooden fantasy game interface pop, a panel sliding in with a light thud and tiny chime, very short, no music, no voice.')
Save-Job 'sfx-impact' @('seed_audio', '--sample_rate', '48000', '--prompt',
  'Sound effect only: epic cinematic impact boom with a deep sub drop and a long shimmering magical golden tail, no music, no voice.')
