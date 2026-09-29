# Собирает листы превью библиотеки (library-preview/*.jpg) для каталога LIBRARY.md.
# Запуск после генерации: .\scripts\library-sheets.ps1
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$lib = 'public\lib'
$out = 'library-preview'
New-Item -ItemType Directory -Force $out | Out-Null
$font = "fontfile='C\:/Windows/Fonts/arial.ttf'"

function Sheet($files, $w, $h, $cols, $dest, $bg = '0x2a1418') {
  $files = @($files | Where-Object { Test-Path $_ })
  if (-not $files.Count) { return }
  $inputs = $files | ForEach-Object { '-i'; $_ }
  $n = $files.Count
  $cells = (0..($n - 1) | ForEach-Object {
      $name = [IO.Path]::GetFileNameWithoutExtension($files[$_])
      "[$_]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:$($h + 28):(ow-iw)/2:(oh-28-ih)/2:color=$bg,drawtext=${font}:text='$name':x=(w-tw)/2:y=h-24:fontsize=18:fontcolor=0xF4CF72[c$_]"
    }) -join ';'
  $rows = [Math]::Ceiling($n / $cols)
  $pad = $rows * $cols - $n
  $extra = ''
  for ($k = 0; $k -lt $pad; $k++) { $extra += ";color=c=${bg}:s=${w}x$($h + 28):d=1[e$k]" }
  $all = (0..($n - 1) | ForEach-Object { "[c$_]" }) + (0..($pad - 1) | Where-Object { $pad -gt 0 } | ForEach-Object { "[e$_]" })
  $rowLabels = @()
  $filters = "$cells$extra"
  for ($r = 0; $r -lt $rows; $r++) {
    $seg = ($all[($r * $cols)..($r * $cols + $cols - 1)]) -join ''
    $filters += ";${seg}hstack=inputs=$cols[r$r]"
    $rowLabels += "[r$r]"
  }
  if ($rows -gt 1) { $filters += ";$($rowLabels -join '')vstack=inputs=$rows" } else { $filters = $filters -replace "\[r0\]$", '' }
  ffmpeg -y -loglevel error @inputs -filter_complex $filters -frames:v 1 -q:v 3 $dest
  "$dest ($n)"
}

$scenes = (Get-ChildItem "$lib\bg\*-v.png" | Sort-Object Name).FullName
Sheet $scenes 180 320 6 "$out\bg-vertical.jpg"
Sheet ((Get-ChildItem "$lib\bg\*-h.png" | Sort-Object Name).FullName) 320 180 4 "$out\bg-horizontal.jpg"
Sheet ((Get-ChildItem "$lib\chars\*.png" | Sort-Object Name).FullName) 200 300 7 "$out\chars.jpg" '0x5a5a5a'
Sheet ((Get-ChildItem "$lib\props\*.png" | Sort-Object Name).FullName) 200 200 6 "$out\props.jpg" '0x5a5a5a'
Sheet ((Get-ChildItem "$lib\fx\*.png" | Sort-Object Name).FullName) 320 180 4 "$out\fx.jpg" '0x000000'

# Живые фоны: кадр из середины каждого клипа
$tmp = Join-Path $env:TEMP 'hp-loops'
New-Item -ItemType Directory -Force $tmp | Out-Null
$frames = foreach ($v in (Get-ChildItem "$lib\loops\*.mp4" -ErrorAction SilentlyContinue | Sort-Object Name)) {
  $png = Join-Path $tmp ($v.BaseName + '.png')
  ffmpeg -y -loglevel error -ss 2.5 -i $v.FullName -frames:v 1 $png
  $png
}
Sheet $frames 180 320 5 "$out\loops.jpg"
