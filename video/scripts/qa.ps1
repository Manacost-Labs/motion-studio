# Поиск рывков и глитчей: сравнивает соседние кадры и печатает резкие изменения.
# Всплески на стыках сцен (вспышка с пульсом) — норма, остальные надо смотреть глазами.
#   .\scripts\qa.ps1 out\hearthpulse-9x16.mp4 -Cuts 95,155,305,420,560,675,795
param([Parameter(Mandatory)][string]$File, [int[]]$Cuts = @(), [double]$Threshold = 0.05)
$lines = ffmpeg -hide_banner -i $File -vf "scale=432:-2,select='gte(scene\,0)',metadata=print:key=lavfi.scene_score:file=-" -an -f null - 2>$null
$n = -1
foreach ($l in $lines) {
  if ($l -match '^frame:(\d+)') { $n = [int]$matches[1] }
  elseif ($l -match 'scene_score=([0-9.]+)') {
    $s = [double]$matches[1]
    if ($s -gt $Threshold) {
      $cut = ($Cuts | Where-Object { [Math]::Abs($_ - $n) -le 9 }).Count -gt 0
      '{0,5}  {1:N3}  {2}' -f $n, $s, $(if ($cut) { 'стык сцен' } else { '<<< проверить' })
    }
  }
}
