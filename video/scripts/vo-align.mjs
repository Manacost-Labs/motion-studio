// Озвучка, записанная большими кусками (коннектор ElevenLabs, студия и т. п.), → файлы по сценам с таймингом каждого символа.
//   node scripts/vo-align.mjs <id> --prepare [--max 2100] [--only сцена,сцена]
//        куски для записи: несколько сцен подряд, между сценами [long pause]. Пишет out/<id>/vo-raw/chunks.json
//        и chunk-<n>.txt — этот текст целиком отдаётся диктору (модели), по одному куску за раз
//   node scripts/vo-align.mjs <id> [--model small|medium]
//        берёт out/<id>/vo-raw/chunk-<n>.mp3 (или .wav), режет по самым длинным паузам на сцены (их столько, сколько стыков;
//        сухие сцены — без потерь, out/<id>/vo-raw/dry/<сцена>.wav),
//        распознаёт каждую сцену локально со временем слов (scripts/vo-words.py, faster-whisper), сопоставляет слова
//        с текстом и пишет public/vo/<id>/<сцена>.mp3 + <сцена>.json — {text, start[], end[]}: время каждого символа
//        текста на экране. Слова, распознанные иначе, чем написано, печатаются для проверки на слух.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {probeDur} from './lib/media.mjs';
import {VIDEO} from './lib/paths.mjs';
import {align, loadConfig, readWords, speakable, tokens, voiceFile} from './vo-lib.mjs';
import {processVoice} from './vo-fx.mjs';

process.chdir(VIDEO);

const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/vo-align.mjs <id> [--prepare [--max N]]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const config = await loadConfig(id);
const raw = path.resolve('out', id, 'vo-raw');
const SEP = '\n\n[long pause]\n\n';
const segs = config.segments.map((s) => ({id: s.id, ...speakable(s.vo, config.pronounce)}));

if (args.includes('--prepare')) {
  const max = Number(opt('max') ?? 2100);
  const chunks = [];
  const only = opt('only')?.split(','); // --only intro,deck-15 — перезаписать только эти сцены
  for (const s of only ? segs.filter((x) => only.includes(x.id)) : segs) {
    const last = chunks.at(-1);
    if (last && last.text.length + SEP.length + s.spoken.length <= max) {
      last.segs.push(s.id);
      last.text += SEP + s.spoken;
    } else chunks.push({n: chunks.length + 1, segs: [s.id], text: s.spoken});
  }
  fs.mkdirSync(raw, {recursive: true});
  fs.writeFileSync(path.join(raw, 'chunks.json'), JSON.stringify(chunks, null, 1));
  for (const c of chunks) {
    fs.writeFileSync(path.join(raw, `chunk-${c.n}.txt`), c.text);
    console.log(`chunk-${c.n}: ${c.text.length} зн. — ${c.segs.join(', ')}`);
  }
  process.exit(0);
}

const chunks = JSON.parse(fs.readFileSync(path.join(raw, 'chunks.json'), 'utf8'));
const outDir = path.resolve('public/vo', id); // тайминги (.json) и обработанный голос
const dryDir = path.join(raw, 'dry'); // сухие записи сцен — из них vo-fx.mjs делает обработанные
fs.mkdirSync(outDir, {recursive: true});
fs.mkdirSync(dryDir, {recursive: true});
const r3 = (x) => Math.round(x * 1000) / 1000;
const probe = probeDur;

// 1) нарезка кусков на сцены по паузам [long pause]
const pieces = [];
for (const c of chunks) {
  const mp3 = voiceFile(raw, `chunk-${c.n}`, ['mp3', 'wav']); // запись куска: mp3 от ElevenLabs или wav
  if (!mp3) {
    console.log(`chunk-${c.n}: нет записи — пропуск`);
    continue;
  }
  const dur = probe(mp3);
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-40dB:d=0.5', '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
  const sil = [...log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => ({a: +m[1], b: +m[2]}));
  const cuts = sil
    .filter((x) => x.a > 0.3 && x.b < dur - 0.3)
    .sort((x, y) => y.b - y.a - (x.b - x.a))
    .slice(0, c.segs.length - 1)
    .sort((x, y) => x.a - y.a);
  if (cuts.length < c.segs.length - 1) throw new Error(`chunk-${c.n}: пауз между сценами ${cuts.length}, нужно ${c.segs.length - 1}`);
  const weak = cuts.filter((x) => x.b - x.a < 0.9);
  if (weak.length) console.warn(`chunk-${c.n}: подозрительно короткие паузы на стыках: ${weak.map((x) => (x.b - x.a).toFixed(2)).join(', ')} с`);
  c.segs.forEach((sid, k) => {
    const a = k === 0 ? 0 : Math.max(0, cuts[k - 1].b - 0.1);
    const b = k === c.segs.length - 1 ? dur : cuts[k].a + 0.3;
    const out = path.join(dryDir, `${sid}.wav`); // без потерь: с потерями голос сжимается один раз — в финальном рендере
    const len = b - a;
    // voice.tempo — темп без изменения высоты голоса (atempo); время слов потом считается уже по ускоренной записи
    const tempo = config.voice?.tempo ?? 1;
    const outLen = len / tempo;
    const af = [tempo !== 1 && `atempo=${tempo}`, 'afade=t=in:d=0.02', `afade=t=out:st=${(outLen - 0.05).toFixed(3)}:d=0.05`].filter(Boolean).join(',');
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', a.toFixed(3), '-t', len.toFixed(3), '-i', mp3, '-af', af, '-c:a', 'pcm_s16le', out]);
    pieces.push({sid, chunk: c.n, src: mp3, from: r3(a), audio: out, words: path.join(raw, `${sid}.words.json`)});
  });
}

// 2) время слов — локальное распознавание (одним запуском модели); уже распознанные и не изменившиеся — пропускаем
const todo = pieces.filter((p) => !fs.existsSync(p.words) || fs.statSync(p.words).mtimeMs < fs.statSync(p.src).mtimeMs);
if (todo.length) {
  const jobs = path.join(raw, 'jobs.json');
  fs.writeFileSync(jobs, JSON.stringify(todo.map((p) => ({audio: p.audio, out: p.words, hint: segs.find((s) => s.id === p.sid).spoken}))));
  const py = path.resolve('.venv-vo/Scripts/python.exe');
  if (!fs.existsSync(py)) throw new Error('Нет .venv-vo: python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install -r requirements.txt');
  const r = spawnSync(py, ['scripts/vo-words.py', jobs, '--model', opt('model') ?? 'small'], {stdio: ['ignore', 'inherit', 'pipe'], env: {...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_SYMLINKS_WARNING: '1'}});
  if (r.status !== 0) throw new Error(`vo-words.py: ${r.stderr?.toString().slice(-800)}`);
}

// 3) сопоставление слов с текстом → время каждого символа текста на экране
for (const p of pieces) {
  const s = segs.find((x) => x.id === p.sid);
  const dur = probe(p.audio);
  const heard = readWords(p.words);
  const toks = tokens(s.shown);
  const match = align(toks, heard);
  const T = toks.map((t, i) => (match[i] >= 0 ? {start: heard[match[i]].start, end: heard[match[i]].end} : null));
  // пропуски — интерполяция по длине слов между соседними распознанными
  for (let i = 0; i < T.length; ) {
    if (T[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < T.length && !T[j]) j++;
    const from = i > 0 ? T[i - 1].end : Math.max(0, (T[j]?.start ?? 0.1) - 0.35 * (j - i));
    const to = j < T.length ? T[j].start : Math.min(dur, from + 0.35 * (j - i));
    const len = toks.slice(i, j).reduce((n, t) => n + t.w.length + 1, 0);
    let acc = 0;
    for (let k = i; k < j; k++) {
      const a = from + ((to - from) * acc) / len;
      acc += toks[k].w.length + 1;
      T[k] = {start: a, end: from + ((to - from) * acc) / len};
    }
    i = j;
  }
  const start = new Array(s.shown.length).fill(null);
  const end = new Array(s.shown.length).fill(null);
  toks.forEach((tok, n) => {
    const tt = T[n];
    for (let ch = tok.a; ch < tok.b; ch++) {
      start[ch] = r3(tt.start + ((tt.end - tt.start) * (ch - tok.a)) / (tok.b - tok.a));
      end[ch] = r3(tt.start + ((tt.end - tt.start) * (ch - tok.a + 1)) / (tok.b - tok.a));
    }
  });
  let prev = 0;
  for (let ch = 0; ch < start.length; ch++) {
    if (start[ch] === null) start[ch] = end[ch] = prev;
    else prev = end[ch];
  }
  fs.writeFileSync(path.join(outDir, `${p.sid}.json`), JSON.stringify({source: `chunk-${p.chunk}`, from: p.from, text: s.shown, start, end}));
  const miss = toks.map((t, i) => i).filter((i) => match[i] < 0 || heard[match[i]].w !== toks[i].w);
  const said = miss.map((i) => `«${s.shown.slice(toks[i].a, toks[i].b)}»→${match[i] >= 0 ? `«${heard[match[i]].text}»` : '—'}`);
  console.log(`${p.sid.padEnd(9)} ${dur.toFixed(1).padStart(5)} с  слов ${toks.length}, распознано иначе ${miss.length}${said.length ? ': ' + said.join(' ') : ''}`);
}

// 4) обработка голоса (адаптер vo-fx.mjs): сухие записи → public/vo
if (pieces.length) processVoice(id, config.voice?.fx ?? 'broadcast', pieces.map((p) => p.sid));
