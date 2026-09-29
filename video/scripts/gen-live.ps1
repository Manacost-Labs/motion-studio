# Оживляет стартовые кадры в Seedance 2.5 и скачивает клипы в public/live
# -Resume "standard=<job_id>;cards=<job_id>" — только дождаться уже отправленных заданий
param([string[]]$Only = @(), [string]$Aspect = '9:16', [string]$PlateDir = 'plates', [string]$OutDir = 'live', [string]$Resume = '')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$plates = Join-Path $root "public\$PlateDir"
$out = Join-Path $root "public\$OutDir"
New-Item -ItemType Directory -Force $out | Out-Null
$style = 'Keep the painterly fantasy illustration style, smooth natural motion.'

$shots = [ordered]@{
  hook     = @(4, 'Slow cinematic push-in. The bearded lich sorcerer in the center raises his clawed hands, swirling green necromantic mist and the glowing ghostly skull spirit above him billow and curl, playing cards and paper scraps flutter through the air, flickering green light, drifting embers.')
  standard = @(5, 'Static camera. The red-eyed orc warrior stays in place and keeps the same size, only his head and shoulders move: he breathes heavily and glares, his eyes glow red, iron chains sway, crimson smoke drifts around him. The dark blurred background stays soft with slow drifting dust.')
  cards    = @(4, 'Static camera. The armored rogue in the lower left shifts his weight and turns his head slightly, his cloak and red cloth ripple, a faint green glow pulses on his armor. The dim blurred background stays soft with floating sparks.')
  arena    = @(5, 'Static camera. The undead cowboy knight on the left lifts his glowing purple scythe onto his shoulder, purple energy tubes pulse with light, his coat sways, icy blue mist swirls through the frozen hall behind him and snow particles drift.')
  bg       = @(4, 'Static camera. The cheerful red-bearded dwarf miner in the foreground lifts the glowing blue crystal, it pulses with bright light and sparkles float up from it, he grins and his braids sway. The goblin and the tavern in the dim background move slightly in flickering candle light.')
  end      = @(4, 'Slow cinematic push-in on a softly blurred sunset scene of adventurers on a cliff: capes, hair and cloth blow in warm wind, a winged creature hovers with buzzing wings, glowing clouds drift, dust and embers float in the air.')
}

# 1. Создаём задания
$jobs = @{}
foreach ($pair in ($Resume -split ';' | Where-Object { $_ })) { $k, $v = $pair -split '='; $jobs[$k] = $v }
foreach ($id in $shots.Keys) {
  if ($Resume) { break }
  if ($Only.Count -and $Only -notcontains $id) { continue }
  $dur, $prompt = $shots[$id]
  $lines = & higgsfield generate create seedance_2_5 --mode omni_reference --start-image (Join-Path $plates "$id.png") `
    --duration $dur --resolution 1080p --aspect_ratio $Aspect --generate_audio false --prompt "$prompt $style" 2>&1 | ForEach-Object { "$_" }
  $jobId = ($lines | Select-String -Pattern '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | Select-Object -First 1).Matches.Value
  if ($jobId) { $jobs[$id] = $jobId; "$id submitted $jobId" } else { "$id SUBMIT FAIL: $($lines -join ' | ')" }
}

# 2. Ждём и скачиваем
foreach ($id in $jobs.Keys) {
  $lines = & higgsfield generate wait $jobs[$id] --timeout 40m --quiet 2>&1 | ForEach-Object { "$_" }
  $url = $lines | Where-Object { $_ -match '^https?://' } | Select-Object -Last 1
  if ($url) { Invoke-WebRequest $url -OutFile (Join-Path $out "$id.mp4"); "$id OK" } else { "$id FAIL: $($lines -join ' | ')" }
}
