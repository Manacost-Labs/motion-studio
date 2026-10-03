// Автопроверка качества YouTube-ролика: node scripts/yt-qa.mjs <id> [--video out/<id>/video.mp4] [--no-video]
// 1) данные ролика (template/qa.ts): голос, субтитры, простои колоды, длина надписей, авторы врезок;
// 2) ассеты: рендеры карт, постеры, врезки, музыка, голос;
// 3) произношение: слова, которые распознавание услышало иначе, чем написано (out/<id>/vo-raw/<сцена>.words.json);
//    термины (имена, карты, сокращения) — предупреждением с подсказкой пополнить словарь pronounce.json;
// 4) готовое видео: громкость и пики, чёрные и застывшие кадры, рывки вне стыков сцен, провалы звука.
// Пишет out/<id>/qa-report.md. Код выхода 1, если есть ошибки (❌).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {bundle} from '@remotion/bundler';
import {selectComposition} from '@remotion/renderer';
import {entryPoint, studioDir} from './studios.mjs';
import {align, dictionary, lev, readWords, tokens} from './vo-lib.mjs';

process.on('unhandledRejection', () => {}); // шрифты шаблона в Node не грузятся — для проверки они не нужны

const args = process.argv.slice(2);
const id = args[0];
if (!id) throw new Error('node scripts/yt-qa.mjs <id> [--video файл] [--no-video]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const issues = [];
const add = (level, seg, what) => issues.push({level, seg, what});

// ── 1. Данные ролика: тайминг из композиции + проверки шаблона ──
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const comp = await selectComposition({serveUrl, id, browserExecutable: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const {config, timing} = comp.props;
const qaOut = path.resolve('node_modules/.cache', 'yt-qa.cjs');
await build({entryPoints: [path.join(studioDir('youtube'), 'template', 'qa.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: qaOut, logLevel: 'error'});
const {audit, expectedJumps} = createRequire(import.meta.url)(qaOut);
for (const i of audit(config, timing)) add(i.level, i.seg, i.what);

// ── 2. Ассеты ──
const pub = (p) => fs.existsSync(path.resolve('public', p));
const need = (p, seg, what) => !pub(p) && add('error', seg, `нет файла ${p} (${what})`);
for (const m of config.music) need(m, 'music', 'музыка');
for (const s of config.segments) {
  if (s.kind !== 'deck') continue;
  if (s.poster) {
    need(s.poster.src, s.id, 'постер');
    s.poster.order.forEach((c) => need(`hs/render/${c}.png`, s.id, 'рендер карты постера'));
  }
  (s.cards ?? []).forEach((c) => need(`hs/render/${c.id}.png`, s.id, 'рендер названной карты'));
  for (const ins of s.inserts ?? []) {
    if (ins.kind === 'combo') ins.cards.forEach((c) => need(`hs/render/${c.id}.png`, s.id, 'карта комбо'));
    if (ins.kind === 'clip') need(ins.src, s.id, 'видео врезки');
  }
}

// ── 3. Произношение по распознаванию ──
// Термин (имя, название карты, сокращение) услышан непохоже на написанное — предупреждение: послушать и, если диктор
// читает неверно, добавить в общий словарь pronounce.json. Обычные слова — к сведению. Слова словаря пишутся
// не так, как читаются, — их не сверяем
const raw = path.resolve('out', id, 'vo-raw');
const skip = new Set(Object.keys({...dictionary(), ...config.pronounce}).map((w) => w.toLowerCase()));
const isTerm = (shown, t) => {
  const word = shown.slice(t.a, t.b);
  const sentenceStart = /(^|[.!?…:—«"(]\s*)$/.test(shown.slice(0, t.a));
  return /['’]/.test(word) || /^[А-ЯЁA-Z]{2,}$/.test(word) || (/^[А-ЯЁA-Z]/.test(word) && !sentenceStart);
};
// похоже: «Грабзи» вместо «Граб'Зи» (так и надо) или другой падеж — «Бездной» вместо «Бездны» (общее начало)
const close = (a, b) => (a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4)) || 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.75;
for (const s of config.segments) {
  const file = path.join(raw, `${s.id}.words.json`);
  if (!fs.existsSync(file)) continue;
  const shown = s.vo.replace(/\[[^\]]*\]\s*/g, '');
  const toks = tokens(shown);
  const heard = readWords(file);
  const m = align(toks, heard);
  // h = null — слово не сопоставилось ни с чем услышанным (прочитано до неузнаваемости или пропущено). Но сначала —
  // склейка услышанного между соседними сопоставленными словами: распознавание дробит имена («Ал 'акир», «Хлад -Ванпир»)
  const gapHeard = (i) => {
    let p = i - 1;
    while (p >= 0 && m[p] < 0) p--;
    let q = i + 1;
    while (q < m.length && m[q] < 0) q++;
    return heard.slice(p >= 0 ? m[p] : 0, q < m.length ? m[q] + 1 : heard.length).map((h) => h.w).join('');
  };
  const odd = toks
    .map((t, i) => ({t, h: m[i] >= 0 ? heard[m[i]] : null, word: shown.slice(t.a, t.b), i}))
    .filter(({t, h, word, i}) => h?.w !== t.w && !/^\d+$/.test(h?.w ?? '') && !skip.has(word.toLowerCase()) && (h || !gapHeard(i).includes(t.w)));
  const terms = odd.filter(({t, h}) => isTerm(shown, t) && t.w.length > 1 && !(h && close(t.w, h.w)));
  const rest = odd.filter((o) => o.h && !terms.includes(o) && o.t.w.length > 3);
  const list = (xs) => xs.map(({word, h}) => `«${word}» → «${h?.text ?? 'не услышано'}»`).join(', ');
  if (terms.length) add('warn', s.id, `термин звучит иначе: ${list(terms)} — послушать; если диктор читает неверно, добавить в src/studios/manacost-youtube/pronounce.json ("${terms[0].word}": "как читать") и перезаписать сцену`);
  if (rest.length) add('info', s.id, `послушать: ${list(rest)}`);
}

// ── 4. Видео ──
const video = opt('video') ?? path.resolve('out', id, 'video.mp4');
const K = (config.fps ?? 30) / (timing.base ?? 30);
if (!args.includes('--no-video') && fs.existsSync(video)) {
  const ff = (a) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], {encoding: 'utf8', maxBuffer: 1 << 28}).stderr;
  const loud = ff(['-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const last = (re) => Number([...loud.matchAll(re)].at(-1)?.[1]); // итог ebur128 — последние значения в логе
  const I = last(/I:\s+(-?[\d.]+) LUFS/g);
  const TP = last(/Peak:\s+(-?[\d.]+) dBFS/g);
  if (!(I >= -15 && I <= -13)) add('warn', 'video', `громкость ${I} LUFS (норма для YouTube −14 ±1)`);
  if (TP > -1) add('error', 'video', `пик ${TP} dBFS — выше −1 dBTP, на YouTube возможны искажения`);
  const fps = comp.fps;
  const vlog = ff(['-i', video, '-an', '-vf', 'scale=432:-2,blackdetect=d=0.4:pix_th=0.08,freezedetect=n=0.002:d=6', '-f', 'null', '-']);
  for (const b of vlog.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) add('warn', 'video', `чёрные кадры ${(+b[1]).toFixed(1)}–${(+b[2]).toFixed(1)} с`);
  const totalSec = (timing.total / (timing.base ?? 30));
  for (const fz of vlog.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)) {
    const at = +fz[1];
    if (at < totalSec - 22) add('warn', 'video', `кадр стоит ${(+fz[2]).toFixed(1)} с с ${at.toFixed(1)} с`);
  }
  // рывки: резкая смена кадра не на стыке сцены (стык — затемнение через пергамент, ±9 кадров)
  const cuts = timing.segments.slice(1).map((t) => Math.round(t.from * K));
  const zones = expectedJumps(config, timing).map(([a, b]) => [a * K, b * K]); // геймплей во врезках, уход сукна топ-3
  const sc = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-an', '-vf', "scale=432:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-", '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 28}).stdout;
  let n = -1;
  for (const line of sc.split('\n')) {
    const fm = line.match(/^frame:(\d+)/);
    if (fm) n = +fm[1];
    const sm = line.match(/scene_score=([\d.]+)/);
    if (sm && +sm[1] > 0.06 && n > 2 && !cuts.some((c) => Math.abs(c - n) <= 9 * K) && !zones.some(([a, b]) => n >= a && n <= b)) add('warn', 'video', `резкая смена кадра на ${n} (${(n / fps).toFixed(1)} с), сила ${(+sm[1]).toFixed(3)} — посмотреть`);
  }
  const alog = ff(['-i', video, '-vn', '-af', 'silencedetect=n=-45dB:d=2', '-f', 'null', '-']);
  for (const s of alog.matchAll(/silence_start: ([\d.]+)/g)) if (+s[1] < totalSec - 6) add('warn', 'video', `тишина дольше 2 с с ${(+s[1]).toFixed(1)} с`);
} else add('info', 'video', 'видео не проверялось (нет файла или --no-video)');

// ── Отчёт ──
const icon = {error: '❌', warn: '⚠️', info: 'ℹ️'};
const count = (l) => issues.filter((i) => i.level === l).length;
const lines = [`# Проверка «${config.title}»`, '', `Ошибок: ${count('error')} · предупреждений: ${count('warn')} · заметок: ${count('info')}`, ''];
for (const level of ['error', 'warn', 'info']) for (const i of issues.filter((x) => x.level === level)) lines.push(`- ${icon[level]} **${i.seg}** — ${i.what}`);
const report = path.resolve('out', id, 'qa-report.md');
fs.mkdirSync(path.dirname(report), {recursive: true});
fs.writeFileSync(report, lines.join('\n') + '\n');
console.log(lines.slice(2, 3).join(''));
for (const i of issues.filter((x) => x.level !== 'info')) console.log(`${icon[i.level]} ${i.seg}: ${i.what}`);
console.log(`→ ${path.relative(process.cwd(), report)}`);
process.exit(count('error') ? 1 : 0);
