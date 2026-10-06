// Проверка перед выпуском YouTube-ролика: node scripts/release.mjs <id> [--no-golden] [--no-video]
// Единый чек-лист «профессиональный ролик» (~25 пунктов): автоматические — ✅ / ⚠️ / ❌, ручные — списком «проверить
// человеку». Запускает yt-qa (по данным и по видео out/<id>/video.mp4) и yt-golden (вид не ушёл от одобренного; --no-golden —
// пропустить), читает judge.json (смысловая проверка выполнена или пропущена явно), лог рендера, обложки, файлы к загрузке.
// Пишет out/<id>/release.md (чек-лист) и release.json (что именно выпускается: коммит и признак незакоммиченных правок,
// sha1 данных ролика — как yt-snap, хэши голоса, параметры видео, LUFS, sha256 файла, версии Chrome и Remotion).
// Готово к выпуску = release.mjs без ❌. Код выхода 1, если есть ❌.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {VIDEO, ROOT} from './lib/paths.mjs';
import {CHROME, openComposition, quietFonts} from './lib/remotion.mjs';
import {findVideo, studio} from './lib/studios.mjs';
import {loadBrand, loadChannel} from './lib/channel.mjs';
import {mmss} from './lib/text.mjs';

process.chdir(VIDEO);
quietFonts();
const args = process.argv.slice(2);
const id = args[0];
const flag = (n) => args.includes(`--${n}`);
if (!id || id.startsWith('--')) throw new Error('node scripts/release.mjs <id> [--no-golden] [--no-video]');
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});
const rel = (f) => path.relative(process.cwd(), f).replace(/\\/g, '/');
const sha = (alg, data) => crypto.createHash(alg).update(data).digest('hex');
const shaFile = (alg, f) => new Promise((ok, fail) => {
  const h = crypto.createHash(alg);
  fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', fail);
});
const mtime = (f) => (f && fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const node = (script, a) => spawnSync(process.execPath, [path.join('scripts', script), ...a], {encoding: 'utf8', maxBuffer: 1 << 26});

// ── Данные ролика ──
const {key, composition: comp} = await openComposition(id, {fallback: 'youtube', logLevel: 'error'});
const {config, timing} = /** @type {{config: any, timing: any}} */ (comp.props);
const own = (() => {
  try {
    return findVideo(id);
  } catch {
    return null;
  }
})();
// пороги — LIMITS канала студии (src/studios/<папка>/channel.ts; scripts/lib/channel.mjs)
const {LIMITS} = await loadChannel(key, 'yt-release');
// юридический блок бренда студии (src/brands/<brand>/channel.ts → legal)
const brand = studio(key).brand;
const {legal: brandLegal} = await loadBrand(key, 'yt-release');
const base = timing.base ?? 30;
const sec = (f) => f / base;
const video = path.join(outDir, 'video.mp4');
const hasVideo = fs.existsSync(video) && !flag('no-video');

// ── yt-qa (по данным и по видео): его итог — qa.json ──
console.log(`yt-qa ${id}${hasVideo ? ' (с видео — несколько минут)' : ' (по данным)'}…`);
const qaStart = Date.now();
const qaRun = node('yt-qa.mjs', [id, ...(hasVideo ? [] : ['--no-video'])]);
const qaFile = path.join(outDir, 'qa.json');
// упавший yt-qa не пишет qa.json — старый отчёт прошлого запуска не должен сойти за свежий
if (mtime(qaFile) < qaStart - 2000) throw new Error(`yt-qa не дописал qa.json (код ${qaRun.status}): ${`${qaRun.stderr}`.trim().split('\n').at(-1) ?? ''}`);
const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
const qi = (re, level) => qa.issues.filter((i) => (level ? i.level === level : i.level !== 'info') && re.test(`${i.seg} ${i.what}`)); // без заметок ℹ

// ── yt-golden: кадры шаблона совпадают с одобренными ──
let golden = {status: 'skip', detail: 'не проверялось (--no-golden)'};
if (!flag('no-golden')) {
  if (!fs.existsSync(path.join('qa', 'golden', id))) golden = {status: 'fail', detail: `нет эталона qa/golden/${id} — после «да» пользователя: node scripts/yt-golden.mjs ${id} --approve`};
  else {
    console.log(`yt-golden ${id}…`);
    const g = node('yt-golden.mjs', [id]);
    const line = `${g.stdout}`.split('\n').find((l) => /кадров сравнено/.test(l)) ?? `${g.stderr}`.trim().split('\n').at(-1);
    golden = g.status === 0 ? {status: 'ok', detail: line} : {status: 'fail', detail: `${line} — out/${id}/golden/diff-*.jpg; изменение одобрено — переснять эталон`};
  }
}

// ── Чек-лист ──
const items = [];
const item = (n, title, status, detail = '') => items.push({n, title, status, detail});
const list = (xs, k = 3) => xs.slice(0, k).map((i) => `${i.seg}: ${i.what}`).join('; ') + (xs.length > k ? ` … и ещё ${xs.length - k}` : '');
const by = (xs, ok = 'ok') => (xs.some((i) => i.level === 'error') ? 'fail' : xs.length ? 'warn' : ok);

// 1. Хук и начало сути
const hook = config.segments.findIndex((s) => s.kind === 'hook');
const firstDeck = config.segments.findIndex((s) => s.kind === 'deck');
const hookSec = hook >= 0 ? sec(timing.segments[hook].dur) : 0;
const deckSec = firstDeck >= 0 ? sec(timing.segments[firstDeck].from) : 0;
item(1, `Хук ≤ ${LIMITS.hookSec} с, первая колода до 0:${LIMITS.firstDeckSec}`, hookSec <= LIMITS.hookSec && deckSec <= LIMITS.firstDeckSec ? 'ok' : 'warn', `${hook >= 0 ? `хук ${hookSec.toFixed(1)} с` : 'хука нет'}, первая колода с ${mmss(deckSec)}`);
item(2, 'Открытая петля в начале и крючки перед разделителями', 'manual', 'перечитать сценарий: интрига заявлена и закрыта в конце');
const vo = qi(/цифры|латиница|\[excited\]|сокращения без подсказки/);
item(3, 'Текст диктора: числа словами, без латиницы и [excited], сокращения в словаре', by(vo), vo.length ? list(vo) : 'yt-qa: замечаний нет');
const terms = qi(/термин звучит иначе/);
item(4, 'Голос: спокойный, паузы, термины звучат верно', terms.length ? 'warn' : 'manual', `${terms.length ? `${list(terms, 2)}; ` : ''}послушать: ears.py, vo-takes`);
const todo = qi(/TODO|не найдена в vo/);
item(5, 'Нет TODO, все фразы-привязки найдены в тексте', by(todo), todo.length ? list(todo) : 'ок');
const idle = qi(/без движения/);
item(6, `Колода не стоит дольше ${LIMITS.idleSec} с, камера без дрожи`, idle.length ? 'warn' : 'ok', idle.length ? list(idle) : 'простоев нет; дрожь камеры — cam-jitter.py');
const jumps = qi(/резкая смена|чёрные кадры|кадр стоит|тишина/);
item(7, 'Нет рывков, чёрных и застывших кадров, провалов звука', !qa.video.checked ? 'fail' : jumps.length ? 'warn' : 'ok', !qa.video.checked ? `видео не проверено — нет out/${id}/video.mp4` : jumps.length ? list(jumps) : 'ок');
const lint = path.join(outDir, 'lint-report.md');
const lintN = fs.existsSync(lint) ? Number(fs.readFileSync(lint, 'utf8').match(/находок: (\d+)/)?.[1] ?? 0) : null;
const fresh = (f) => mtime(f) >= Math.max(mtime(own?.configPath), mtime(own && path.join(own.dir, 'article.json')));
item(8, 'Текст не за краем и не друг на друге (yt-lint)', lintN === null ? 'warn' : lintN || !fresh(lint) ? 'warn' : 'ok', lintN === null ? `не запускался: node scripts/yt-lint.mjs ${id}` : `${lintN} находок${fresh(lint) ? '' : ', отчёт старше конфига — перезапустить'} — ${rel(lint)}`);
item(9, 'Читается на телефоне (смысловой текст ≥ 24 px@1080, контраст)', 'manual', '30 с черновика на телефоне');
const pace = qa.pace.gaps;
item(10, `Темп: новинка не реже раза в ${LIMITS.paceGapSec} с`, pace.length ? 'warn' : 'ok', pace.length ? `${pace.map(([a, b]) => `${mmss(a)}–${mmss(b)}`).join(', ')} — out/${id}/pace.md` : 'ок');
item(11, 'Вид не ушёл от одобренного (yt-golden)', golden.status, golden.detail);
const v = qa.video;
const loudOk = v.checked && v.lufs >= LIMITS.lufs - LIMITS.lufsTol && v.lufs <= LIMITS.lufs + LIMITS.lufsTol && v.peak <= LIMITS.peak;
item(12, `Громкость ${LIMITS.lufs} ±${LIMITS.lufsTol} LUFS, пик ≤ ${LIMITS.peak} dBTP`, v.checked ? (loudOk ? 'ok' : 'fail') : 'fail', v.checked ? `${v.lufs} LUFS, пик ${v.peak}` : 'нет видео');
item(13, 'Музыка не перекрывает голос и не надоедает', 'manual', 'ears.py --video + прослушать целиком в наушниках');
const spec = qi(/^video (файл|формат пикселей|цвет|звук|в файле нет звука|длина файла)/);
item(14, `Файл: ${LIMITS.video.w}×${LIMITS.video.h}, ${LIMITS.video.fps} к/с, yuv420p BT.709, AAC 48 кГц, длина = ролик`, !v.checked ? 'fail' : by(spec), !v.checked ? `нет ${rel(video)} — чистовой рендер: .\\scripts\\render.ps1 -Studio youtube -Comp ${id} -Out "${id}\\video" -Scale 2 -JpegQuality 95` : spec.length ? list(spec) : `${v.probe.w}×${v.probe.h}, ${v.probe.fps} к/с, ${v.probe.pix}, ${v.probe.space}`);
const log = video.replace(/\.mp4$/, '.render.log');
// лог перезаписывается каждым запуском render.ps1: последний запуск упал («!!!») — прежнее видео осталось, но рендер не «без ошибок»
const logText = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
const logFailed = /^!!! /m.test(logText) || !/^готово: /m.test(logText);
item(15, 'Рендер завершился без ошибок, лог сохранён', !fs.existsSync(log) || logFailed ? 'fail' : mtime(log) >= mtime(video) - 120000 ? 'ok' : 'warn', !fs.existsSync(video) ? 'нет видео' : !fs.existsSync(log) ? `нет ${rel(log)} — рендер не новым render.ps1 или не завершён` : logFailed ? `последний рендер не завершился (${logText.match(/^!!! (.*)$/m)?.[1]?.trim() ?? 'нет строки «готово»'}) — ${rel(log)}` : rel(log));
// обложки: все варианты есть, легче 2 МБ, не старше конфига; .jpg тяжёлого PNG и лист читаемости — не старше PNG
// (yt-thumb пишет их сразу после PNG; старые от прошлого прогона показывают прежнюю обложку — не засчитываем)
const thumbs = ['thumbnail.png', ...(config.thumbs ?? []).slice(0, LIMITS.thumbVariants - 1).map((_, i) => `thumbnail-${'bc'[i]}.png`)].map((f) => path.join(outDir, f));
const thumbBad = thumbs.filter((f) => !fs.existsSync(f) || !fresh(f));
const heavy = thumbs.filter((f) => fs.existsSync(f) && fs.statSync(f).size > LIMITS.thumbBytes && mtime(f.replace(/\.png$/, '.jpg')) < mtime(f));
const sheet = path.join(outDir, 'thumbs-sheet.jpg');
const sheetOld = mtime(sheet) < Math.max(0, ...thumbs.map(mtime));
item(16, `Обложки: ${thumbs.length} вариант(а), каждая < 2 МБ, лист читаемости`, thumbBad.length || heavy.length ? 'fail' : sheetOld ? 'warn' : 'ok', thumbBad.length ? `нет или старше конфига: ${thumbBad.map((f) => path.basename(f)).join(', ')} — node scripts/yt-thumb.mjs ${id}` : heavy.length ? `тяжелее 2 МБ, а .jpg нет или он старше PNG: ${heavy.map((f) => path.basename(f)).join(', ')} — node scripts/yt-thumb.mjs ${id}` : sheetOld ? `лист ${rel(sheet)} ${fs.existsSync(sheet) ? 'старше обложек' : 'не собран'} — node scripts/yt-thumb.mjs ${id}` : `${thumbs.map((f) => `${path.basename(f)} ${(fs.statSync(f).size / 1048576).toFixed(2)} МБ`).join(', ')}; выбор по out/${id}/thumbs-sheet.jpg — за человеком`);
const titleIss = qi(/^описание (название|вариант названия|в названии)/);
item(17, `Название ≤ ${LIMITS.title} знаков, есть варианты для теста`, titleIss.length ? 'warn' : config.seo?.titles?.length ? 'ok' : 'warn', titleIss.length ? list(titleIss) : config.seo?.titles?.length ? `${config.title.length} зн. + ${config.seo.titles.length} варианта (titles.txt)` : 'нет вариантов названия (config.seo.titles)');
// описание: лид, главы, материалы, хэштеги; файлы к загрузке не старше конфига и голоса
const desc = path.join(outDir, 'description.txt');
const text = fs.existsSync(desc) ? fs.readFileSync(desc, 'utf8') : '';
const descIss = qi(/^описание (пустой лид|лид|хэштег|теги|глав|первая глава)/);
const clipsCC = config.segments.flatMap((s) => (s.kind === 'deck' ? s.inserts ?? [] : [])).filter((i) => i.kind === 'clip');
const descMiss = [!text && 'нет description.txt', text && config.seo?.lead && !text.startsWith(config.seo.lead.trim()) && 'первая строка — не лид', text && !/Таймкоды:/.test(text) && 'нет глав', text && clipsCC.length && !/Использованные материалы:/.test(text) && 'нет блока «Использованные материалы»'].filter(Boolean);
// главы не по правилам YouTube (в yt-qa — ⚠) к выпуску — ❌: YouTube молча их не покажет
item(18, 'Описание: лид, главы (0:00, ≥ 3, ≥ 10 с), коды, материалы, ссылки, хэштеги', descMiss.length || descIss.some((i) => i.level === 'error' || /глав/.test(i.what)) ? 'fail' : descIss.length || !config.seo ? 'warn' : 'ok', [...descMiss, ...descIss.map((i) => i.what), !config.seo && 'нет config.seo'].filter(Boolean).join('; ') || `ок — ${rel(desc)}`);
const stale = qi(/^выпуск /);
const subs = qi(/субтитр|строка субтитра/);
item(19, 'Файлы к загрузке свежие; .srt ≤ 42 знаков в строке, ≤ 17 зн./с', stale.length ? 'fail' : subs.length ? 'warn' : 'ok', [stale.length && list(stale, 5), subs.length && `субтитры: ${subs.length} замечаний (qa-report.md)`].filter(Boolean).join('; ') || 'ок');
const rights = qi(/паспорт|лицензи|источник врезки|manifest/);
item(20, 'Права: паспорт у каждого клипа (CC BY / своя запись / согласие), лицензии музыки', by(rights), rights.length ? list(rights, 4) : 'ок');
const probes = config.segments.flatMap((s) => (s.kind === 'deck' ? (s.inserts ?? []).filter((i) => i.kind === 'clip' && i.probe).map((i) => `${s.id}: ${i.src}`) : []));
item(21, 'Нет пробных врезок (probe)', probes.length ? 'fail' : 'ok', probes.length ? `${probes.join(', ')} — заменить своей записью этой колоды (rec.mjs take) или убрать` : 'ок');
// оговорка правообладателя — legal бренда (src/brands/<brand>/channel.ts): задана — должна быть в description.txt (её дописывает
// yt-export); обязательна (legal.required), но не задана — ❌; находки yt-qa «право» — ❌: товарный знак в названии канала
// (legal.forbidden) или слово, выдающее ролик за официальный, в названии и тегах ролика (legal.forbiddenInVideo)
const disclaimer = brandLegal.disclaimer.trim();
const banned = qi(/^право /);
const legalState = banned.length || (disclaimer ? !text.includes(disclaimer) : brandLegal.required) ? 'fail' : disclaimer ? 'ok' : 'skip';
item(
  22,
  'Оговорка правообладателя в описании; канал без товарных знаков, ролик не выдаёт себя за официальный',
  legalState,
  [
    disclaimer ? (text.includes(disclaimer) ? 'оговорка есть' : 'оговорки нет в description.txt — node scripts/yt-export.mjs ' + id) : brandLegal.required ? `оговорка обязательна, но не задана — legal.disclaimer в src/brands/${brand}/channel.ts` : `не задана (legal бренда ${brand}) — для этого канала не обязательна`,
    banned.length && list(banned, 3),
  ]
    .filter(Boolean)
    .join('; '),
);
// смысловая проверка: выполнена без ❌ и без ожидающих ответа или пропущена явно (judge.mjs --backend off / нет ключа)
const jf = path.join(outDir, 'judge.json');
const judge = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, 'utf8')) : null;
const judgeStale = judge && Date.parse(judge.date) < Math.max(mtime(own?.configPath), 0);
item(
  23,
  'Смысловая проверка (judge.mjs) выполнена или пропущена явно',
  // явный пропуск (--backend off) и «нет вопросов» — ✅; нет ключа или сервис недоступен — ⚠ (проверка не выполнена)
  !judge ? 'fail' : judge.skipped ? (judge.backend === 'off' || /^нет вопросов/.test(judge.reason ?? '') ? 'ok' : 'warn') :judge.pending || judge.counts?.pending ? 'fail' : judge.counts?.error ? 'fail' : judgeStale || judge.scenes || judge.counts?.warn ? 'warn' : 'ok',
  !judge
    ? `не запускалась: node scripts/judge.mjs ${id} (без ключей — бэкенд agent; явный пропуск — --backend off)`
    : judge.skipped
      ? `пропущена явно: ${judge.reason}`
      : `${judge.backend}: ❌ ${judge.counts.error} · ⚠ ${judge.counts.warn} · ✅ ${judge.counts.ok}${judge.counts.pending ? ` · ждут ответа ${judge.counts.pending}` : ''}${judge.scenes ? ` · только сцены ${judge.scenes.join(', ')}` : ''}${judgeStale ? ' · старше конфига — перезапустить' : ''} — out/${id}/judge-report.md`,
);
item(24, 'Авторская ценность: мнение Манакоста, своя запись игры, отличие от прошлых роликов', 'manual', '');
item(25, 'Фрагмент показан, «да» получено, отзыв записан в TASTE.md, эталоны одобрены', 'manual', '');
const voDir = path.resolve('public', 'vo', id);
const voFiles = fs.existsSync(voDir) ? fs.readdirSync(voDir).filter((f) => /\.(mp3|wav|m4a|json)$/.test(f)).sort() : [];
const voNewest = Math.max(0, ...voFiles.map((f) => mtime(path.join(voDir, f))));
const videoFresh = fs.existsSync(video) && fresh(video) && mtime(video) >= voNewest;
item(26, 'Видео новее конфига и голоса', videoFresh ? 'ok' : 'fail', !fs.existsSync(video) ? 'нет чистового видео' : videoFresh ? 'ок' : 'видео старше конфига или голоса — перерендерить');
item(27, 'Выпуск записан: release.json (коммит, sha1 данных, sha256 видео, версии)', 'ok', `out/${id}/release.json`);
item(28, 'Через 7 и 28 дней: удержание по сценам, CTR и победитель теста обложек → LEARNINGS.md', 'manual', `node scripts/yt-metrics.mjs ${id} <retention.csv>`);
if (config.seo?.playlist) item(29, `Добавить в плейлист «${config.seo.playlist}», закрепить комментарий`, 'manual', fs.existsSync(path.join(outDir, 'pinned-comment.txt')) ? `out/${id}/pinned-comment.txt` : '');

// ── release.json: что именно выпускается ──
const git = (a) => spawnSync('git', a, {cwd: ROOT, encoding: 'utf8'}).stdout.trim();
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => [k, canon(x[k])])) : x);
const voice = {};
for (const f of voFiles) voice[f] = sha('sha256', fs.readFileSync(path.join(voDir, f)));
const chromeVersion = (() => {
  try {
    return fs.readdirSync(path.dirname(CHROME)).find((d) => /^\d+(\.\d+){3}$/.test(d)) ?? null; // папка версии рядом с chrome.exe
  } catch {
    return null;
  }
})();
const release = {
  id,
  date: new Date().toISOString(),
  commit: git(['rev-parse', 'HEAD']),
  dirty: git(['status', '--porcelain']).length > 0,
  configSha1: sha('sha1', JSON.stringify(canon({props: comp.props, dur: comp.durationInFrames, fps: comp.fps}), null, 1)), // как yt-snap
  duration: sec(timing.total),
  voice,
  video: fs.existsSync(video) ? {file: rel(video), bytes: fs.statSync(video).size, sha256: await shaFile('sha256', video), probe: v.probe ?? null, lufs: v.lufs ?? null, peak: v.peak ?? null} : null,
  thumbs: Object.fromEntries(thumbs.filter((f) => fs.existsSync(f)).map((f) => [path.basename(f), {bytes: fs.statSync(f).size, sha256: sha('sha256', fs.readFileSync(f))}])),
  chrome: chromeVersion,
  remotion: JSON.parse(fs.readFileSync(path.join('node_modules', 'remotion', 'package.json'), 'utf8')).version,
  judge: judge ? {backend: judge.backend, skipped: !!judge.skipped, counts: judge.counts ?? null} : null,
  checklist: Object.fromEntries(['fail', 'warn', 'ok', 'manual', 'skip'].map((s) => [s, items.filter((i) => i.status === s).length])),
};
fs.writeFileSync(path.join(outDir, 'release.json'), JSON.stringify(release, null, 1) + '\n');

// ── release.md ──
const icon = {ok: '✅', warn: '⚠️', fail: '❌', manual: '👤', skip: '➖'};
const fails = items.filter((i) => i.status === 'fail');
const md = [
  `# Выпуск «${config.title}»`,
  '',
  `${new Date().toLocaleString('ru-RU')} · коммит ${release.commit.slice(0, 7)}${release.dirty ? ' + незакоммиченные правки' : ''} · данные ${release.configSha1.slice(0, 10)} · ${mmss(release.duration)}`,
  '',
  fails.length ? `**Не готово: ❌ ${fails.length}** · ⚠️ ${release.checklist.warn} · ✅ ${release.checklist.ok} · проверить человеку ${release.checklist.manual}` : `**Готово к выпуску** (❌ нет) · ⚠️ ${release.checklist.warn} · ✅ ${release.checklist.ok} · проверить человеку ${release.checklist.manual}`,
  '',
  '| # | пункт | | подробности |',
  '|---|---|---|---|',
  ...items.filter((i) => i.status !== 'manual').map((i) => `| ${i.n} | ${i.title} | ${icon[i.status]} | ${(i.detail || '').replace(/\|/g, '/')} |`),
  '',
  '## Проверить человеку',
  '',
  ...items.filter((i) => i.status === 'manual').map((i) => `- [ ] ${i.title}${i.detail ? ` — ${i.detail}` : ''}`),
  '',
  `Подробности: out/${id}/qa-report.md, pace.md${judge && !judge.skipped ? ', judge-report.md' : ''}, release.json.`,
];
fs.writeFileSync(path.join(outDir, 'release.md'), md.join('\n') + '\n');
console.log(md[4].replace(/\*\*/g, ''));
for (const i of items.filter((x) => x.status === 'fail' || x.status === 'warn')) console.log(`${icon[i.status]} ${i.n}. ${i.title}: ${i.detail}`);
console.log(`→ out/${id}/release.md, release.json`);
process.exit(fails.length ? 1 : process.exitCode ?? 0);
