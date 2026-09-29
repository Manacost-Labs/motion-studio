# Готовит ассеты для Remotion: кадрирует интерфейс, уменьшает арты и персонажей.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # ...\video
$proj = Split-Path -Parent $root                                              # ...\Hearthpulse Ads
$pub = Join-Path $root 'public'

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L

function Save-Crop($src, $x, $y, $w, $h, $dst, $maxW = 0) {
  $img = [System.Drawing.Image]::FromFile($src)
  $w = [Math]::Min($w, $img.Width - $x); $h = [Math]::Min($h, $img.Height - $y)
  $s = if ($maxW -gt 0 -and $w -gt $maxW) { $maxW / $w } else { 1.0 }
  $ow = [int]($w * $s); $oh = [int]($h * $s)
  $bmp = New-Object System.Drawing.Bitmap $ow, $oh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $ow, $oh), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), 'Pixel')
  if ($dst -like '*.jpg') { $bmp.Save($dst, $jpegCodec, $jpegParams) } else { $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png) }
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  "$(Split-Path -Leaf $dst)  ${ow}x${oh}"
}
function Save-Scaled($src, $dst, $maxSide) {
  $img = [System.Drawing.Image]::FromFile($src)
  $w = $img.Width; $h = $img.Height; $img.Dispose()
  $s = [Math]::Min(1.0, $maxSide / [Math]::Max($w, $h))
  Save-Crop $src 0 0 $w $h $dst ([int]($w * $s))
}

# --- Интерфейс из 2x-съёмки (координаты в CSS px, умножаются на 2)
$cap = Join-Path $root 'capture'
$ui2x = @(
  @('home', 329, 100, 1041, 395, 'home-stage.png'),
  @('home', 987, 144, 338, 307, 'home-top-classes.png'),
  @('home', 329, 1388, 1041, 722, 'home-bg-directory.png'),
  @('home', 329, 2186, 1041, 710, 'home-arena-directory.png'),
  @('meta', 282, 954, 560, 230, 'meta-card-1.png'),
  @('meta', 856, 954, 560, 230, 'meta-card-2.png'),
  @('meta', 282, 1197, 560, 230, 'meta-card-3.png'),
  @('meta', 282, 1456, 1134, 275, 'meta-paywall.png'),
  @('archetypes', 282, 765, 1134, 1300, 'archetypes-table.png'),
  @('cards', 282, 677, 1134, 930, 'cards-grid.png'),
  @('articles', 282, 589, 1134, 812, 'articles.png'),
  @('fundecks', 282, 807, 1134, 584, 'fundecks.png'),
  @('cosmetics', 282, 395, 1134, 1000, 'cosmetics.png')
)
foreach ($c in $ui2x) {
  Save-Crop (Join-Path $cap "$($c[0]).png") ($c[1] * 2) ($c[2] * 2) ($c[3] * 2) ($c[4] * 2) (Join-Path $pub "ui\$($c[5])")
}

# --- Закрытые разделы из скриншотов владельца (1x, координаты в пикселях исходника)
$ui1x = @(
  @('герои бг.png', 395, 290, 1350, 670, 'bg-heroes.png'),
  @('легендарные группы.png', 440, 195, 1265, 530, 'arena-legendaries.png'),
  @('стратегии.png', 395, 200, 1345, 570, 'bg-strategies.png'),
  @('сушества полей сражений.png', 410, 170, 1320, 760, 'bg-minions.png'),
  @('vs gold.png', 415, 180, 1310, 645, 'vs-gold.png'),
  @('библиотека.png', 395, 305, 1350, 655, 'cards-hover.png'),
  @('карта.png', 0, 0, 1360, 822, 'card-aya.png')
)
foreach ($c in $ui1x) {
  Save-Crop (Join-Path $proj $c[0]) $c[1] $c[2] $c[3] $c[4] (Join-Path $pub "ui\$($c[5])")
}

# --- Арты Blizzard (JPEG, до 3200 px) и персонажи (PNG с прозрачностью, до 1600 px)
$art = @(
  @('naxramax 8k.jpg', 'naxx.jpg'),
  @('Ii1ZRz.jpg', 'gvg.jpg'),
  @('Deathknight.jpg', 'frozen-throne.jpg'),
  @('wallpapersden.com_hearthstone-heroes-of-warcraft_3840x2034.jpg', 'badlands.jpg'),
  @('cover-3 (9).jpg', 'emerald.jpg'),
  @('Rastakhan_s_Rumble_Key_Art_No_Border.jpg', 'rastakhan.jpg')
)
foreach ($a in $art) { Save-Scaled (Join-Path $proj "арты харстоун\$($a[0])") (Join-Path $pub "art\$($a[1])") 3200 }

$chars = @(
  @('warrior1.png', 'orc.png'), @('rogue.png', 'rogue.png'), @('death knight.png', 'dk.png'),
  @('grok-5da66a6b-7bde-493e-81a3-0b63958572c2.png', 'dwarf.png'), @('mage.png', 'mage.png'),
  @('priest.png', 'priest.png'), @('warlock.png', 'warlock.png'), @('warrior.png', 'tauren.png')
)
foreach ($c in $chars) { Save-Scaled (Join-Path $proj "персонажи\$($c[0])") (Join-Path $pub "chars\$($c[1])") 1600 }
