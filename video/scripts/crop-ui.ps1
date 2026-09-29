# Вырезает блоки интерфейса из 2x-съёмки (capture/*.png) в public/ui.
# Координаты — в CSS px (как в capture/*.json), скрипт умножает их на 2.
# Новый кадр = новая строка в $crops. Запуск: .\scripts\crop-ui.ps1 [имя-файла ...]
param([string[]]$Only = @())
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cap = Join-Path $root 'capture'
$ui = Join-Path $root 'public\ui'

#            страница          x    y     w     h     файл
$crops = @(
  @('a-archetypes',    282,  767, 1119, 2400, 'archetypes-table.png'),
  @('a-cards-hover',   282,  662,  520,  368, 'cards-hover.png'),
  # Наведение на карту: основа без подсказки + слои hover-состояния (поднятая карта и подсказка)
  @('a-cards-nohover', 282,  662,  520,  368, 'cards-nohover.png'),
  @('a-cards-hover',   282,  662,  185,  368, 'cards-hover-card.png'),
  @('a-cards-hover',   467,  714,  320,  312, 'cards-hover-popup.png'),
  @('a-classes',       282,  628, 1119,  813, 'arena-classes.png'),
  @('a-legendaries',   282,  828, 1119, 1140, 'arena-legendaries.png'),
  @('a-heroes',        306, 1338, 1071, 1900, 'bg-heroes.png'),
  @('a-bg-tierlist',   333,  575, 1017, 1641, 'bg-strategies.png'),
  @('a-vsgold',        282,  425, 1119, 2037, 'vs-gold.png'),
  @('a-bg-minion',     306,  159, 1071, 1353, 'bg-minion.png'),
  @('a-matchups',      282,  684, 1119,  664, 'matchups.png'),
  @('a-matchups',      282, 1387, 1119,  725, 'matchups-summary.png')
)

foreach ($c in $crops) {
  if ($Only.Count -and $Only -notcontains $c[5]) { continue }
  $img = [System.Drawing.Image]::FromFile((Join-Path $cap "$($c[0]).png"))
  $x = $c[1] * 2; $y = $c[2] * 2
  $w = [Math]::Min($c[3] * 2, $img.Width - $x); $h = [Math]::Min($c[4] * 2, $img.Height - $y)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), 'Pixel')
  $bmp.Save((Join-Path $ui $c[5]), [System.Drawing.Imaging.ImageFormat]::Png)
  "{0,-24} {1}x{2}" -f $c[5], $w, $h
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
