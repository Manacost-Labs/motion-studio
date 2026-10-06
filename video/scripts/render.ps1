# Рендер ролика + мастеринг звука под соцсети (-14 LUFS, пики не выше -1.5 dBTP)
# -Studio — ключ студии из src/studios/studios.json (ads, features, youtube); без него — по id композиции (папка ролика
#           или префикс id), иначе ads. Список студий: node scripts/studios.mjs
# .\scripts\render.ps1 -Comp HearthPulseAd -Out hearthpulse-9x16
# .\scripts\render.ps1 -Studio features -Comp Feature-Matchups -Out feature-matchups-9x16
# .\scripts\render.ps1 -Out hearthpulse-9x16 -MasterOnly   — только пересвести звук готового файла
# .\scripts\render.ps1 -Studio youtube -Comp yt-legend-decks-sep26 -Out yt-legend-decks-sep26\video -Scale 2 -JpegQuality 95   — YouTube в 4K
# -Draft — черновик для проб: половинное разрешение, 30 к/с (REMOTION_DRAFT → calcVoiced), сжатие сильнее; в 3–4 раза быстрее.
#          Кадры для -Frames в черновике — секунда × 30 (в чистовике YouTube — × 60)
# -Frames "A-B" — только отрезок; -Notify — уведомление Windows, когда рендер готов (для долгих рендеров в фоне)
# -Concurrency N — сколько кадров рендерить параллельно. По умолчанию 4: замер npx remotion benchmark 04.10.2026
#          (yt-legend-decks-sep26, 1080p, кадры 0–300): 4 → 34,5 с, 8 → 36,4 с, 12 → 36,8 с, 16 — браузер не отвечает
# -Gl angle — рендер WebGL через ANGLE: нужен, если в кадре «живой арт» (DepthArt, three.js)
# Цвет: YouTube-студии (kind youtube) — BT.709, yuv420p, диапазон tv (метки в файле); реклама — как раньше.
# Предохранители: полный вывод — в out\<Out>.render.log; при любом сбое — тост «Рендер упал», код 1, а прежний
# out\<Out>.mp4 остаётся нетронутым (новый файл заменяет его только после успешного сведения звука).
# .\scripts\render.ps1 -Studio youtube -Comp yt-legend-decks-sep26 -Out yt-legend-decks-sep26\draft -Draft -Frames 0-900
param(
  [string]$Studio = '',
  [string]$Comp = 'HearthPulseAd',
  [string]$Out = 'hearthpulse-9x16',
  [switch]$MasterOnly,
  [double]$Scale = 1,
  [int]$JpegQuality = 80,
  [switch]$Draft,
  [string]$Frames = '',
  [switch]$Notify,
  [ValidateRange(1, 64)][int]$Concurrency = 4,
  [ValidateSet('', 'angle', 'angle-egl', 'egl', 'swangle', 'swiftshader', 'vulkan')][string]$Gl = ''
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$prevEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [Text.Encoding]::UTF8 # node и ffmpeg пишут UTF-8
$utf8 = New-Object System.Text.UTF8Encoding $false
$raw = "out\$Out-raw.mp4"
$part = "out\$Out.part.mp4"
$final = "out\$Out.mp4"
$log = "out\$Out.render.log"
$logPath = Join-Path $root $log
New-Item -ItemType Directory -Force (Split-Path -Parent $logPath) | Out-Null
[IO.File]::WriteAllText($logPath, "render.ps1 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') · $((@($PSBoundParameters.GetEnumerator()) | ForEach-Object { "-$($_.Key) $($_.Value)" }) -join ' ')`r`n", $utf8)
$started = Get-Date
$tail = New-Object System.Collections.Generic.Queue[string]

# Уведомление Windows (тост); если тосты недоступны — звуковой сигнал
function Show-Toast([string]$title, [string]$text) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $t = $xml.GetElementsByTagName('text')
    $t.Item(0).AppendChild($xml.CreateTextNode($title)) | Out-Null
    $t.Item(1).AppendChild($xml.CreateTextNode($text)) | Out-Null
    $app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch {
    [console]::beep(880, 300)
  }
}

function Write-Log([string]$text) { [IO.File]::AppendAllText($logPath, "$text`r`n", $utf8) }

# Сбой: хвост вывода на экран, тост, код 1. Готовый out\<Out>.mp4 не трогаем, недоделанные файлы убираем
function Stop-Render([string]$why) {
  $last = @($tail | Where-Object { $_.Trim() }) | Select-Object -Last 1
  Write-Log "`r`n!!! $why"
  @($tail) | Select-Object -Last 15 | ForEach-Object { Write-Host $_ }
  Write-Host "✗ Рендер упал: $why. Полный лог: $log" -ForegroundColor Red
  Remove-Item $part, $raw -ErrorAction SilentlyContinue
  Remove-Item Env:REMOTION_DRAFT -ErrorAction SilentlyContinue
  Show-Toast 'Рендер упал' "${Out}: $(if ($last) { $last } else { $why })"
  [Console]::OutputEncoding = $prevEncoding
  exit 1
}

# Внешняя программа: вывод — в лог (сразу, построчно) и в хвост для сообщения об ошибке; успех — по коду выхода.
# -Keep — вернуть весь вывод (замер громкости)
function Invoke-Step([string]$name, [string]$exe, [string[]]$argv, [switch]$Keep) {
  Write-Log "`r`n>>> ${name}: $exe $($argv -join ' ')"
  $tail.Clear()
  $all = New-Object System.Collections.Generic.List[string]
  $w = New-Object System.IO.StreamWriter($logPath, $true, $utf8)
  $w.AutoFlush = $true
  $ErrorActionPreference = 'Continue' # stderr у node и ffmpeg — обычный вывод, не ошибка PowerShell
  try {
    & $exe @argv 2>&1 | ForEach-Object {
      $s = "$_"
      if ($s -eq 'System.Management.Automation.RemoteException') { $s = '' } # пустая строка stderr в PowerShell 5.1
      $w.WriteLine($s)
      $tail.Enqueue($s)
      if ($tail.Count -gt 40) { [void]$tail.Dequeue() }
      if ($Keep) { $all.Add($s) }
    }
    $code = $LASTEXITCODE
  } finally {
    $w.Dispose()
  }
  if ($code -ne 0) { Stop-Render "$name — код выхода $code" }
  return $all
}

try {
  if (-not $Studio) {
    $Studio = node scripts/studios.mjs of $Comp ads
    if ($LASTEXITCODE -ne 0) { Stop-Render "не определил студию композиции $Comp" }
  }
  $st = (node scripts/studios.mjs get $Studio) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $st) { Stop-Render "нет студии «$Studio» в src/studios/studios.json (node scripts/studios.mjs)" }
  $chrome = if ($env:CHROME_PATH) { $env:CHROME_PATH } else { 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
  Write-Log "студия $($st.key) ($($st.dir), $($st.kind)) · композиция $Comp · Chrome $chrome"

  if ($MasterOnly) {
    if (-not (Test-Path $final)) { Stop-Render "нет $final — нечего пересводить" }
    Copy-Item $final $raw -Force
  } else {
    Remove-Item $raw -ErrorAction SilentlyContinue # остаток прошлого сбоя не должен сойти за новый рендер
    $crf = 18
    if ($Draft) {
      $env:REMOTION_DRAFT = '1'
      $Scale = [Math]::Min($Scale, 0.5)
      $JpegQuality = 70
      $crf = 26
    }
    $argv = @('remotion', 'render', "src/studios/$($st.dir)/index.ts", $Comp, $raw, "--browser-executable=$chrome", '--codec=h264', "--crf=$crf", "--scale=$($Scale.ToString('R', [Globalization.CultureInfo]::InvariantCulture))", "--jpeg-quality=$JpegQuality", "--concurrency=$Concurrency")
    if ($Frames) { $argv += "--frames=$Frames" }
    if ($Gl) { $argv += "--gl=$Gl" }
    if ($st.kind -eq 'youtube') { $argv += '--color-space=bt709' } # zscale в BT.709, yuv420p tv и метки цвета в файле
    Invoke-Step 'remotion render' 'npx' $argv | Out-Null
    Remove-Item Env:REMOTION_DRAFT -ErrorAction SilentlyContinue
    @($tail) | Where-Object { $_.Trim() } | Select-Object -Last 2 | ForEach-Object { Write-Host $_ }
    if (-not (Test-Path $raw)) { Stop-Render "Remotion не создал $raw" }
  }

  $hasAudio = (ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 $raw)
  # битый или недописанный файл: ffprobe падает и пустой ответ сошёл бы за «звука нет» — прежний mp4 был бы затёрт
  if ($LASTEXITCODE -ne 0) { Stop-Render "ffprobe не прочитал $raw — код выхода $LASTEXITCODE" }
  if (-not $hasAudio) {
    Write-Host 'звуковой дорожки нет — без сведения'
    Move-Item $raw $final -Force
  } else {
    # Двухпроходная нормализация: замер, затем точная линейная коррекция
    $target = 'I=-14:TP=-1.5:LRA=11'
    $json = (Invoke-Step 'громкость: замер' 'ffmpeg' @('-hide_banner', '-i', $raw, '-af', "loudnorm=${target}:print_format=json", '-f', 'null', '-') -Keep) -join "`n"
    $i = $json.LastIndexOf('{')
    if ($i -lt 0) { Stop-Render 'замер громкости не вернул JSON loudnorm' }
    $m = ($json.Substring($i) -replace '(?s)\}.*', '}') | ConvertFrom-Json
    $af = "loudnorm=${target}:measured_I=$($m.input_i):measured_TP=$($m.input_tp):measured_LRA=$($m.input_lra):measured_thresh=$($m.input_thresh):offset=$($m.target_offset):linear=true"
    Invoke-Step 'громкость: сведение' 'ffmpeg' @('-y', '-loglevel', 'error', '-i', $raw, '-c:v', 'copy', '-af', $af, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', $part) | Out-Null
    $report = Invoke-Step 'громкость: итог' 'ffmpeg' @('-hide_banner', '-i', $part, '-af', 'ebur128=peak=true', '-f', 'null', '-') -Keep
    $report | Select-String -Pattern '^\s+I:|^\s+Peak:' | Select-Object -Last 2 | ForEach-Object { Write-Host $_.Line }
    Move-Item $part $final -Force # только теперь заменяем прежний файл
    Remove-Item $raw
  }
} catch {
  Stop-Render "$($_.Exception.Message) ($($_.InvocationInfo.PositionMessage -replace '\s+', ' '))"
} finally {
  # Успех, сбой (exit 1 в Stop-Render) или Ctrl+C: черновой режим и кодировка консоли не остаются в сессии PowerShell —
  # иначе следующие yt-golden и yt-lint из той же сессии отрисуют черновик, и эталоны ложно «изменятся»
  Remove-Item Env:REMOTION_DRAFT -ErrorAction SilentlyContinue
  [Console]::OutputEncoding = $prevEncoding
}

$took = [int]((Get-Date) - $started).TotalMinutes
Write-Log "`r`nготово: $final ($took мин)"
if ($Notify) { Show-Toast 'Рендер готов' "$final · $took мин" }
"$final ($took мин)"
