// Проверка окружения студии: всё ли установлено для рендера, голоса, «ушей» и «глаз». Ничего не меняет и не тратит.
//   node scripts/doctor.mjs
// ✓ — есть, ✗ — нет и без этого не работает рендер или проверки, ⚠ — нет, но нужно только части команд.
// Ключи video/.env — только «есть / нет», значения не печатаются.
//   node scripts/doctor.mjs --clean-bundles — единственное, что меняет диск: удаляет из %TEMP% только папки старше суток —
//   remotion-webpack-bundle-* (копии public/ по ~0,7 ГБ от прошлых сборок), remotion-v*-assets* (загрузки рендеров) и
//   puppeteer_dev_chrome_profile-* (профили Chrome рендера) — и только если не идёт ни один рендер — нет процессов
//   Remotion (node с remotion в командной строке, compositor remotion.exe, Chrome рендера).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {hasKey, KEYS} from './lib/env.mjs';
import {ROOT, VIDEO} from './lib/paths.mjs';
import {CHROME} from './lib/remotion.mjs';
import {STUDIOS, entryPoint} from './lib/studios.mjs';

process.chdir(VIDEO);

// Остатки Remotion в TEMP: bundle() кладёт туда копию public/ и не убирает её (bundleStudio убирает при выходе,
// но прерванные и прежние запуски оставляют); каждый renderStill/selectComposition без puppeteerInstance заводит свой
// профиль Chrome и папку загрузок, а прерванный запуск (и Chrome, держащий файлы на Windows) их не убирает.
// Старше суток — точно не идущий рендер
const DAY = 24 * 3600 * 1000;
const tmp = os.tmpdir();
const LEFTOVER = /^(remotion-webpack-bundle-|remotion-v\d+\.\d+\.\d+-assets|puppeteer_dev_chrome_profile-)/;
const oldLeftovers = () =>
  fs
    .readdirSync(tmp, {withFileTypes: true})
    .filter((d) => d.isDirectory() && LEFTOVER.test(d.name))
    .map((d) => path.join(tmp, d.name))
    .filter((f) => {
      try {
        const s = fs.statSync(f);
        return Date.now() - Math.max(s.mtimeMs, s.birthtimeMs) > DAY;
      } catch {
        return false; // убрана, пока смотрели (выход другого скрипта)
      }
    });
const freeGbIn = (dir) => {
  const st = fs.statfsSync(dir);
  return (st.bavail * st.bsize) / 2 ** 30;
};

if (process.argv.includes('--clean-bundles')) {
  // Идёт ли рендер: процессы Remotion по командной строке. Не удалось проверить — не удаляем
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "[Console]::OutputEncoding = [Text.Encoding]::UTF8; @(Get-CimInstance Win32_Process -Filter \"Name='node.exe' OR Name='chrome.exe' OR Name='chrome-headless-shell.exe' OR Name='remotion.exe'\" | Select-Object ProcessId, Name, CommandLine) | ConvertTo-Json -Compress",
    ],
    {encoding: 'utf8', maxBuffer: 1 << 26},
  );
  if (ps.status !== 0) {
    console.error(`✗ не удалось получить список процессов (powershell, код ${ps.status}) — сборки не удаляю`);
    process.exit(1);
  }
  /** @type {{ProcessId: number, Name: string, CommandLine: string | null}[]} */
  const procs = [JSON.parse(ps.stdout.trim() || '[]')].flat();
  // node: npx remotion render / studio, @remotion/cli; Chrome рендера — безголовый, с профилем во временной папке
  // (Remotion и puppeteer: puppeteer_dev_chrome_profile-*), только главный процесс браузера (без --type=): осиротевшие
  // служебные процессы упавшего браузера рендер не ведут; remotion.exe — compositor Remotion (кодирование кадров)
  const busy = procs.filter(
    (p) =>
      p.ProcessId !== process.pid &&
      (/^remotion\.exe$/i.test(p.Name) ||
        (/^node\.exe$/i.test(p.Name) && /remotion/i.test(p.CommandLine ?? '')) ||
        (/^chrome(-headless-shell)?\.exe$/i.test(p.Name) && /puppeteer_dev_chrome_profile|--headless/i.test(p.CommandLine ?? '') && !/\s--type=/.test(p.CommandLine ?? ''))),
  );
  if (busy.length) {
    console.error(`✗ идёт рендер или проверка Remotion — сборки не удаляю. Процессы (${busy.length}):`);
    for (const p of busy.slice(0, 8)) console.error(`  ${p.ProcessId} ${p.Name} ${(p.CommandLine ?? '').slice(0, 140)}`);
    console.error('Дождитесь окончания (или закройте студию Remotion) и запустите снова.');
    process.exit(1);
  }
  const dirs = oldLeftovers();
  const before = freeGbIn(tmp);
  console.log(`Остатков Remotion и Chrome рендера старше суток в ${tmp}: ${dirs.length}${dirs.length ? ' — удаляю…' : ''}`);
  const failed = [];
  dirs.forEach((f, i) => {
    try {
      fs.rmSync(f, {recursive: true, force: true, maxRetries: 3});
    } catch (e) {
      failed.push(`${path.basename(f)}: ${e.code ?? e.message}`);
    }
    if ((i + 1) % 10 === 0 && i + 1 < dirs.length) console.log(`  ${i + 1} из ${dirs.length}`);
  });
  console.log(`Удалено ${dirs.length - failed.length} из ${dirs.length} · освободилось ${Math.max(0, freeGbIn(tmp) - before).toFixed(1)} ГБ · свободно ${freeGbIn(tmp).toFixed(1)} ГБ`);
  if (failed.length) console.log(`Не удалось (заняты) — ${failed.length}:\n  ${failed.slice(0, 8).join('\n  ')}`);
  process.exit(failed.length ? 1 : 0);
}

const rows = [];
const add = (mark, what, detail) => rows.push({mark, what, detail});
const ver = (bin, args = ['-version']) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', shell: process.platform === 'win32' && !/\.exe$/i.test(bin)});
  return r.status === 0 ? `${r.stdout}${r.stderr}`.trim().split(/\r?\n/)[0] : null;
};

// Node и пакеты, которые скрипты импортируют напрямую
add(Number(process.versions.node.split('.')[0]) >= 22 ? '✓' : '✗', 'Node', `${process.version} (нужен ≥ 22: process.loadEnvFile, Map.groupBy)`);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const p of ['remotion', '@remotion/cli', '@remotion/bundler', '@remotion/renderer', 'esbuild', 'puppeteer-core', 'typescript']) {
  const file = path.join('node_modules', p, 'package.json');
  const declared = pkg.dependencies?.[p] ?? pkg.devDependencies?.[p];
  if (!fs.existsSync(file)) add('✗', p, 'не установлен — npm install');
  else add(declared ? '✓' : '⚠', p, `${JSON.parse(fs.readFileSync(file, 'utf8')).version}${declared ? '' : ' — нет в package.json, пришёл транзитивно'}`);
}

// Программы
const ffmpeg = ver('ffmpeg');
add(ffmpeg ? '✓' : '✗', 'ffmpeg', ffmpeg ?? 'нет в PATH — нужен рендеру, проверкам и голосу');
const ffprobe = ver('ffprobe');
add(ffprobe ? '✓' : '✗', 'ffprobe', ffprobe ? ffprobe.replace(/ Copyright.*/, '') : 'нет в PATH');
const ytdlp = ver('yt-dlp', ['--version']);
add(ytdlp ? '✓' : '⚠', 'yt-dlp', ytdlp ?? 'нет в PATH — нужен только eyes.mjs (поиск и нарезка чужих роликов)');
if (fs.existsSync(CHROME)) {
  const v = spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${CHROME}').VersionInfo.ProductVersion`], {encoding: 'utf8'}).stdout.trim();
  add('✓', 'Chrome', `${v || '?'} · ${CHROME}${process.env.CHROME_PATH ? ' (CHROME_PATH)' : ''} — обновление Chrome может сдвинуть эталоны golden/check-ads`);
} else add('✗', 'Chrome', `нет ${CHROME} — рендер и проверки не запустятся (другой путь — переменная CHROME_PATH)`);
// Место: каждая сборка Remotion копирует public/ (~0,7 ГБ) в TEMP; при 0 байт рендер и проверки падают с ENOSPC
const freeGb = freeGbIn(tmp);
const stale = oldLeftovers().length;
add(freeGb < 5 ? '✗' : freeGb < 30 ? '⚠' : '✓', 'место на диске', `${freeGb.toFixed(1)} ГБ свободно в ${tmp}${stale ? ` · остатков Remotion старше суток там: ${stale} (сборки, загрузки, профили Chrome)${stale > 10 ? ' — удалить, когда рендер не идёт: node scripts/doctor.mjs --clean-bundles' : ''}` : ''}`);
const hf = spawnSync('where', ['higgsfield'], {encoding: 'utf8'});
add(hf.status === 0 ? '✓' : '⚠', 'Higgsfield CLI', hf.status === 0 ? hf.stdout.trim().split(/\r?\n/)[0] : 'нет в PATH — нужен только генерации (gen-*.ps1, credits.mjs)');
// auto-editor — движение в кадре для rec.mjs idle и take --tight; бинарник релиза GitHub в tools/ (на PyPI нет 31.x).
// Версия закреплена: вывод levels и синтаксис --edit менялись между версиями
const AE_VERSION = '31.7.2';
const aeLocal = path.resolve('tools/auto-editor/auto-editor.exe');
const ae = ver(fs.existsSync(aeLocal) ? aeLocal : 'auto-editor', ['--version']);
add(ae === AE_VERSION ? '✓' : '⚠', 'auto-editor', ae ? `${ae}${fs.existsSync(aeLocal) ? ' · tools/auto-editor' : ' (PATH)'}${ae === AE_VERSION ? '' : ` — проверен ${AE_VERSION}, levels --edit motion мог измениться`}` : `нет — нужен только rec.mjs idle и take --tight: ${AE_VERSION} с GitHub (recordings/README.md)`);

// Python-окружение .venv-vo (голос, «уши», «глаза», глубина) — по requirements.txt
const py = path.resolve('.venv-vo/Scripts/python.exe');
if (!fs.existsSync(py)) add('⚠', '.venv-vo', 'нет — python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install -r requirements.txt (нужен vo-align, vo-takes, ears, eyes scenes, depth)');
else {
  const want = fs.existsSync('requirements.txt')
    ? fs.readFileSync('requirements.txt', 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).map((l) => l.split(/[=<>~!]=?/)[0].trim().toLowerCase())
    : [];
  const have = new Map(spawnSync(py, ['-m', 'pip', 'list', '--format=freeze', '--disable-pip-version-check'], {encoding: 'utf8'}).stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('==')).map(([n, v]) => [n.toLowerCase().replace(/_/g, '-'), v]));
  const missing = want.filter((w) => !have.has(w.replace(/_/g, '-')));
  add(missing.length ? '⚠' : '✓', '.venv-vo', missing.length ? `не хватает: ${missing.join(', ')} — .venv-vo/Scripts/python -m pip install -r requirements.txt` : want.map((w) => `${w} ${have.get(w.replace(/_/g, '-'))}`).join(', '));
}

// Ключи — только «есть / нет»
for (const k of Object.keys(KEYS).filter((k) => k !== 'CHROME_PATH')) add(hasKey(k) ? '✓' : '⚠', k, `${hasKey(k) ? 'есть' : 'нет'} — ${KEYS[k]}`);

// Студии и хуки
for (const s of STUDIOS) add(fs.existsSync(entryPoint(s.key)) ? '✓' : '✗', `студия ${s.key}`, `src/studios/${s.dir}/index.ts${fs.existsSync(entryPoint(s.key)) ? '' : ' — нет точки входа'}`);
const hooks = spawnSync('git', ['config', 'core.hooksPath'], {cwd: ROOT, encoding: 'utf8'}).stdout.trim();
add(hooks === 'video/scripts/hooks' ? '✓' : '⚠', 'git-хуки', hooks ? `core.hooksPath = ${hooks}` : 'не подключены — git config core.hooksPath video/scripts/hooks');

const w = Math.max(...rows.map((r) => r.what.length));
for (const r of rows) console.log(`${r.mark} ${r.what.padEnd(w)}  ${r.detail}`);
const bad = rows.filter((r) => r.mark === '✗').length;
console.log(bad ? `\n✗ критичного не хватает: ${bad}` : '\nОкружение в порядке (⚠ — нужно только части команд).');
process.exit(bad ? 1 : 0);
