// Проверка раскладки YouTube-ролика без взгляда человека: node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92] [--no-read]
// Рендерит кадры сцен со встроенным зондом (src/core/qa/lint.tsx, REMOTION_LINT) и собирает из браузера настоящие границы
// надписей: текст за краем кадра, текст на тексте из разных блоков, текст поверх постера или карт веера (data-qa-clear).
// Пишет out/<id>/lint-report.md; код выхода 1, если что-то нашлось. Кадры — посередине и к концу сцен, когда всё
// уже появилось (вход и уход страницы не проверяются — там наложения по замыслу).
// Раздел «Читаемость» (телефон) — только ⚠, в код выхода и в число находок не входит: смысловой текст мельче
// LIMITS.readMinPx (px кадра 1080p; мелкий по замыслу — data-qa-small-ok) и контраст с однотонным фоном ниже
// LIMITS.readMinContrast (пороги — VIDEO_LIMITS, src/core/qa/limits.ts). Надпись сцены судится по лучшему из проверенных
// кадров (появление, уход и наезд камеры не в счёт); место — файл компонента (по именам React-компонентов из зонда).
// Раздел «Время чтения» — тоже только ⚠: смысловая надпись должна быть на экране не меньше LIMITS.readMinSec +
// LIMITS.readPerWordSec за слово сверх LIMITS.readFreeWords, в финальной сцене — не меньше LIMITS.readOutroSec (правило —
// github.com/whaleyxbt/claude-motion, MIT). Замер — проход выбранных сцен частыми кадрами без снимков (зонд в режиме seen);
// --no-read — пропустить проход.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderFrames, renderStill} from '@remotion/renderer';
import {VIDEO} from './lib/paths.mjs';
import {CHROME, openComposition, quietFonts} from './lib/remotion.mjs';
import {loadChannel} from './lib/channel.mjs';
import {studio} from './lib/studios.mjs';

process.chdir(VIDEO);
quietFonts();
// строки зонда «YTLINT {…}» и «YTSEEN {…}» Remotion сам печатает в терминал (console.debug из бандла → verbose) — их читает
// onBrowserLog, в терминал не пускаем
const print = console.log;
console.log = (...a) => (a.some((x) => /YT(LINT|SEEN) /.test(String(x))) ? undefined : print(...a));
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92] [--no-read]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const pats = args.slice(1).filter((a) => !a.startsWith('--') && a !== opt('at')).map((a) => new RegExp(a));
const at = (opt('at') ?? '0.3,0.6,0.92').split(',').map(Number);

const browserExecutable = CHROME;
const envVariables = {REMOTION_LINT: '1'};
const {key, serveUrl, composition} = await openComposition(id, {envVariables, logLevel: 'error'});
const {LIMITS} = await loadChannel(key, 'yt-lint'); // пороги читаемости — readMinPx, readMinContrast (VIDEO_LIMITS)
const {timing} = /** @type {any} */ (composition.props); // props YouTube-композиции: {config, timing}
const K = composition.fps / (timing.base ?? 30);
const tmp = path.join(os.tmpdir(), 'yt-lint.jpg');

const found = [];
const read = []; // замеры читаемости (src/core/qa/lint.tsx → readDom)
let checked = 0;
const chosen = timing.segments.filter((s) => !pats.length || pats.some((p) => p.test(s.id)));
for (const t of chosen) {
  for (const q of at) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((t.from + q * t.dur) * K));
    let report;
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: tmp,
      scale: 0.25,
      browserExecutable,
      envVariables,
      logLevel: 'error',
      onBrowserLog: (log) => {
        if (log.text.startsWith('YTLINT ')) report = JSON.parse(log.text.slice(7));
      },
    });
    checked++;
    if (!report) {
      found.push({seg: t.id, sec: frame / composition.fps, kind: 'probe', text: 'зонд не ответил'});
      continue;
    }
    for (const i of report.issues) found.push({seg: t.id, sec: frame / composition.fps, ...i});
    for (const r of report.read?.samples ?? []) read.push({seg: t.id, sec: frame / composition.fps, ...r, comp: report.read.chains[r.comp] ?? []});
  }
}

const what = {edge: 'текст за краем кадра', overlap: 'текст на тексте', clear: 'текст на', probe: 'нет данных'};
const fmt = (i) => `${i.seg} · ${i.sec.toFixed(1)} с — ${what[i.kind]}${i.kind === 'clear' ? ` «${i.other}»` : ''}: «${i.text.slice(0, 40)}»${i.kind === 'overlap' ? ` и «${(i.other ?? '').slice(0, 40)}»` : ''}${i.box ? ` [${Math.round(i.box.left)},${Math.round(i.box.top)}–${Math.round(i.box.right)},${Math.round(i.box.bottom)}]` : ''}`;
// одинаковые находки на соседних кадрах — одной строкой
const uniq = [...new Map(found.map((i) => [`${i.seg}|${i.kind}|${i.text}|${i.other ?? ''}`, i])).values()];
const lines = [`# Раскладка «${id}»`, '', `Кадров проверено: ${checked} · находок: ${uniq.length}`, '', ...uniq.map((i) => `- ${fmt(i)}`)];
const layoutText = lines.slice(2).join('\n');

// ── Читаемость (⚠): надпись сцены — по лучшему кадру (наибольший кегль, наибольший контраст) ──
const best = new Map();
for (const r of read) {
  const k = `${r.seg}|${r.text}`;
  const b = best.get(k) ?? {...r, sizeSec: r.sec, ratioSec: r.sec};
  if (r.size !== null && (b.size === null || r.size > b.size)) Object.assign(b, {size: r.size, sizeSec: r.sec, comp: r.comp});
  if (r.ratio !== null && (b.ratio === null || r.ratio > b.ratio)) Object.assign(b, {ratio: r.ratio, fg: r.fg, bg: r.bg, halo: r.halo, ratioSec: r.sec});
  best.set(k, b);
}
// имя React-компонента → файл: объявления «const|function Имя» в общих слоях и своей студии (зонд знает только имена)
const SRC = path.resolve('src');
const defs = new Map();
const ownDirs = ['core', 'looks', 'games', 'brands', `studios/${studio(key).dir}`];
for (const f of fs.readdirSync(SRC, {recursive: true}).map(String)) {
  const posix = f.replace(/\\/g, '/');
  if (!/\.tsx?$/.test(f) || !ownDirs.some((d) => posix.startsWith(`${d}/`))) continue;
  const rel = `src/${posix}`;
  for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/^(?:export\s+)?(?:default\s+)?(?:const|function)\s+([A-Z]\w*)/gm)) defs.set(m[1], [...(defs.get(m[1]) ?? []), rel]);
}
const SKIP = new Set(['VoicedVideo', 'LintProbe']); // движок и сам зонд — не место надписи
// место надписи: ближайший свой компонент и следующий за ним другой свой файл (обычно деталь ← сцена)
const placeOf = (comp = []) => {
  const out = [];
  for (const n of comp.filter((x) => defs.has(x) && !SKIP.has(x))) {
    const files = defs.get(n).join(' | ');
    if (!out.some((o) => o.files === files)) out.push({files, where: `${files} (${n})`});
    if (out.length === 2) break;
  }
  return out.map((o) => o.where).join(' ← ') || `файл не найден (компоненты: ${comp.slice(0, 3).join(' ← ') || 'нет данных'})`;
};
const minPx = LIMITS.readMinPx;
const minRatio = LIMITS.readMinContrast;
const all = [...best.values()];
const small = all.filter((b) => b.size !== null && b.size < minPx);
const pale = all.filter((b) => b.ratio !== null && b.ratio < minRatio);
const unmeasured = all.filter((b) => b.ratio === null);
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');
const readFound = [
  ...small.map((b) => ({place: placeOf(b.comp), line: `${b.seg} · ${b.sizeSec.toFixed(1)} с — мелкий текст ${num(b.size)} px (< ${minPx}): «${b.text.slice(0, 40)}»`})),
  ...pale.map((b) => ({
    place: placeOf(b.comp),
    line: `${b.seg} · ${b.ratioSec.toFixed(1)} с — контраст ${num(b.ratio, 2)}:1 (< ${num(minRatio)}): «${b.text.slice(0, 40)}» ${b.fg} на ${b.bg}, ${b.size === null ? 'мелкий по замыслу' : `${num(b.size)} px`}${b.halo ? ', есть тень или обводка' : ''}`,
  })),
];
const byPlace = new Map();
for (const r of readFound) byPlace.set(r.place, [...(byPlace.get(r.place) ?? []), r.line]);
const why = new Map();
for (const b of unmeasured) why.set(b.why ?? 'нет данных', (why.get(b.why ?? 'нет данных') ?? 0) + 1);
lines.push(
  '',
  '## Читаемость (телефон, ⚠)',
  '',
  `Только предупреждения: в код выхода и в число находок выше не входят. Порог — смысловой текст от ${minPx} px при 1080p (мелкий по замыслу — data-qa-small-ok), контраст с однотонным фоном от ${num(minRatio)}:1. Надпись сцены — по лучшему из проверенных кадров.`,
  '',
  `Мест: ${readFound.length} · мелкий текст: ${small.length} · низкий контраст: ${pale.length} · надписей: ${all.length}, контраст не мерился у ${unmeasured.length}${unmeasured.length ? ` (${[...why].map(([w, n]) => `${w} — ${n}`).join('; ')})` : ''}`,
  ...[...byPlace].flatMap(([place, ls]) => ['', `### ${place}`, '', ...ls.map((l) => `- ⚠ ${l}`)]),
);

// ── Время чтения (⚠): сколько смысловая надпись на экране ──
// Правило — из github.com/whaleyxbt/claude-motion (MIT): надпись видна не меньше readMinSec + readPerWordSec за каждое слово
// сверх readFreeWords, надпись финальной сцены — не меньше readOutroSec (VIDEO_LIMITS). Замер — кадры выбранных сцен на сетке
// каждые READ_STEP с одним проходом renderFrames без снимков (зонд seen: только список видимых надписей). «На экране» —
// opacity с предками от READ_OPACITY. Не судятся: субтитры (их длину и скорость проверяет yt-qa), мелкое по замыслу
// (data-qa-small-ok), надписи, обрезанные краем выбранных сцен или кадром, на который зонд не ответил. Счётчик (надпись из
// одних цифр: «12» → «54») — одна надпись. Без ложных тревог: ⚠, только если даже с запасом в шаг ((n + 1)·шаг) надпись короче
const READ_STEP = 0.2; // с между кадрами прохода
const READ_OPACITY = 0.5;
let readRun = null; // итог прохода для консоли
if (!args.includes('--no-read')) {
  const t0 = Date.now();
  const step = Math.max(1, Math.round(READ_STEP * composition.fps));
  const grid = new Set();
  for (const t of chosen) for (let f = Math.ceil((t.from * K) / step) * step; f < Math.min(composition.durationInFrames, (t.from + t.dur) * K); f += step) grid.add(f);
  const frames = [...grid].sort((a, b) => a - b);
  const seenAt = new Map(); // кадр → {chains, seen} от зонда
  await renderFrames({
    serveUrl,
    composition,
    inputProps: {},
    frames,
    imageFormat: 'none',
    outputDir: null,
    muted: true,
    browserExecutable,
    envVariables: {REMOTION_LINT: 'seen'},
    logLevel: 'error',
    onStart: () => {},
    onFrameUpdate: () => {},
    onBrowserLog: (log) => {
      if (log.text.startsWith('YTSEEN ')) {
        const r = JSON.parse(log.text.slice(7));
        seenAt.set(r.frame, r);
      }
    },
  });
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const subTexts = new Set(timing.segments.flatMap((s) => (s.subs ?? []).map((u) => norm(u.text))));
  const keyOf = (s) => (/\p{L}/u.test(s) ? norm(s) : norm(s).replace(/\d+([.,]\d+)?/g, '#'));
  // серии: надпись видна на кадрах сетки подряд
  const runs = [];
  const open = new Map(); // ключ → серия
  let prev = null;
  for (const f of frames) {
    const r = seenAt.get(f);
    const here = new Map();
    for (const [text, o, smallOk, ci] of r?.seen ?? []) {
      if (o < READ_OPACITY || smallOk || subTexts.has(norm(text))) continue;
      const k = keyOf(text);
      if (!here.has(k)) here.set(k, {text, comp: r.chains[ci] ?? []});
    }
    const next = r && prev !== null && f - prev === step; // этот кадр продолжает предыдущий
    for (const [k, run] of open)
      if (!next || !here.has(k)) {
        runs.push(run);
        open.delete(k);
      }
    for (const [k, v] of here) {
      const run = open.get(k);
      if (run) Object.assign(run, {b: f, n: run.n + 1});
      else open.set(k, {key: k, text: v.text, comp: v.comp, a: f, b: f, n: 1});
    }
    prev = r ? f : null;
  }
  runs.push(...open.values());
  const answered = new Set(seenAt.keys());
  // обрезана: перед первым или после последнего кадра серии ролик идёт, а замера нет (край выбранных сцен, зонд молчал)
  const cut = (run) => (run.a >= step && !answered.has(run.a - step)) || (run.b + step < composition.durationInFrames && !answered.has(run.b + step));
  const lastFrom = timing.segments.at(-1).from * K;
  const segAt = (f) => [...timing.segments].reverse().find((t) => f >= t.from * K) ?? timing.segments[0];
  const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const brief = [];
  for (const run of runs.filter((x) => !cut(x))) {
    const w = words(run.text);
    const outro = run.a >= lastFrom;
    const need = Math.max(LIMITS.readMinSec + LIMITS.readPerWordSec * Math.max(0, w - LIMITS.readFreeWords), outro ? LIMITS.readOutroSec : 0);
    if (((run.n + 1) * step) / composition.fps < need) brief.push({...run, w, need, outro, sec: (run.n * step) / composition.fps, seg: segAt(run.a).id});
  }
  const byPlaceR = new Map();
  for (const b of brief) {
    const place = placeOf(b.comp);
    const line = `${b.seg} · ${(b.a / composition.fps).toFixed(1)} с — «${b.text.slice(0, 50)}» на экране ≈ ${num(b.sec)} с (нужно ${num(b.need, 2)} с: слов ${b.w}${b.outro ? ', финальная сцена' : ''})`;
    byPlaceR.set(place, [...(byPlaceR.get(place) ?? []), line]);
  }
  const silent = frames.length - seenAt.size;
  const cutN = runs.filter(cut).length;
  readRun = {frames: frames.length, sec: (Date.now() - t0) / 1000, brief: brief.length};
  lines.push(
    '',
    '## Время чтения (⚠)',
    '',
    `Только предупреждения: в код выхода и в число находок не входят. Порог — от ${num(LIMITS.readMinSec)} с + ${num(LIMITS.readPerWordSec, 2)} с за слово сверх ${LIMITS.readFreeWords}, в финальной сцене — от ${num(LIMITS.readOutroSec)} с (правило github.com/whaleyxbt/claude-motion). Замер — кадры каждые ${num(step / composition.fps, 2)} с (точность — шаг), «на экране» — opacity от ${num(READ_OPACITY)}; субтитры и data-qa-small-ok не судятся.`,
    '',
    `Коротких: ${brief.length} · надписей: ${new Set(runs.map((r) => r.key)).size} (появлений ${runs.length}, обрезано краем замера ${cutN}) · кадров: ${frames.length}${silent ? `, зонд не ответил на ${silent}` : ''}`,
    ...[...byPlaceR].flatMap(([place, ls]) => ['', `### ${place}`, '', ...ls.map((l) => `- ⚠ ${l}`)]),
  );
}

fs.mkdirSync(path.resolve('out', id), {recursive: true});
fs.writeFileSync(path.resolve('out', id, 'lint-report.md'), lines.join('\n') + '\n');
console.log(layoutText);
console.log(`⚠ читаемость (код выхода не меняет): мест ${readFound.length} — мелкий текст ${small.length}, низкий контраст ${pale.length}`);
if (readRun) console.log(`⚠ время чтения (код выхода не меняет): коротких надписей ${readRun.brief} — кадров ${readRun.frames} за ${Math.round(readRun.sec)} с`);
console.log(`→ out/${id}/lint-report.md`);
process.exit(uniq.length ? 1 : (process.exitCode ?? 0));
