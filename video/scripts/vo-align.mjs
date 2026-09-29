// Озвучка, записанная большими кусками (коннектор ElevenLabs, студия и т. п.), → файлы по сценам с таймингом каждого символа.
//   node scripts/vo-align.mjs <id> --prepare [--max 2100]
//        куски для записи: несколько сцен подряд, между сценами [long pause]. Пишет out/<id>/vo-raw/chunks.json
//        и chunk-<n>.txt — этот текст целиком отдаётся диктору (модели), по одному куску за раз
//   node scripts/vo-align.mjs <id> [--model small|medium]
//        берёт out/<id>/vo-raw/chunk-<n>.mp3, режет по самым длинным паузам на сцены (их столько, сколько стыков),
//        распознаёт каждую сцену локально со временем слов (scripts/vo-words.py, faster-whisper), сопоставляет слова
//        с текстом и пишет public/vo/<id>/<сцена>.mp3 + <сцена>.json — {text, start[], end[]}: время каждого символа
//        текста на экране. Слова, распознанные иначе, чем написано, печатаются для проверки на слух.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadConfig, speakable} from './vo-lib.mjs';

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
  for (const s of segs) {
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

// ── Сопоставление ──
const norm = (w) => w.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
const tokens = (text) => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => ({w: norm(m[0]), a: m.index, b: m.index + m[0].length}));
const lev = (a, b) => {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const sim = (a, b) => {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) return 0.6;
  return 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.7 ? 0.5 : -0.6;
};
// Выравнивание двух последовательностей слов (Нидлман — Вунш): для каждого слова текста — индекс распознанного или -1
const align = (A, B) => {
  const GAP = -0.4;
  const n = A.length;
  const m = B.length;
  const S = Array.from({length: n + 1}, () => new Float32Array(m + 1));
  const P = Array.from({length: n + 1}, () => new Uint8Array(m + 1)); // 1 — диагональ, 2 — вверх, 3 — влево
  for (let i = 1; i <= n; i++) (S[i][0] = i * GAP), (P[i][0] = 2);
  for (let j = 1; j <= m; j++) (S[0][j] = j * GAP), (P[0][j] = 3);
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const d = S[i - 1][j - 1] + sim(A[i - 1].w, B[j - 1].w);
      const u = S[i - 1][j] + GAP;
      const l = S[i][j - 1] + GAP;
      if (d >= u && d >= l) (S[i][j] = d), (P[i][j] = 1);
      else if (u >= l) (S[i][j] = u), (P[i][j] = 2);
      else (S[i][j] = l), (P[i][j] = 3);
    }
  const out = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    if (P[i][j] === 1) {
      if (sim(A[i - 1].w, B[j - 1].w) > 0) out[i - 1] = j - 1;
      i--, j--;
    } else if (P[i][j] === 2) i--;
    else j--;
  }
  return out;
};

// Распознавание Scribe: принимаем {words:[{text,start,end,type}]} или просто массив слов
const readWords = (file) => {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(j) ? j : j.words ?? j.transcripts?.[0]?.words ?? j.transcript?.words;
  if (!list) throw new Error(`${file}: не нашёл список слов`);
  return list
    .filter((w) => (w.type ?? 'word') === 'word')
    .map((w) => ({w: norm(w.text ?? w.word), start: w.start ?? w.start_time, end: w.end ?? w.end_time, text: w.text ?? w.word}))
    .filter((w) => w.w);
};

const chunks = JSON.parse(fs.readFileSync(path.join(raw, 'chunks.json'), 'utf8'));
const outDir = path.resolve('public/vo', id);
fs.mkdirSync(outDir, {recursive: true});
const r3 = (x) => Math.round(x * 1000) / 1000;
const probe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {encoding: 'utf8'}).stdout);

// 1) нарезка кусков на сцены по паузам [long pause]
const pieces = [];
for (const c of chunks) {
  const mp3 = path.join(raw, `chunk-${c.n}.mp3`);
  if (!fs.existsSync(mp3)) {
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
    const out = path.join(outDir, `${sid}.mp3`);
    const len = b - a;
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', a.toFixed(3), '-t', len.toFixed(3), '-i', mp3, '-af', `afade=t=in:d=0.02,afade=t=out:st=${(len - 0.05).toFixed(3)}:d=0.05`, '-c:a', 'libmp3lame', '-b:a', '192k', out]);
    pieces.push({sid, chunk: c.n, from: r3(a), audio: out, words: path.join(raw, `${sid}.words.json`)});
  });
}

// 2) время слов — локальное распознавание (одним запуском модели); уже распознанные и не изменившиеся — пропускаем
const todo = pieces.filter((p) => !fs.existsSync(p.words) || fs.statSync(p.words).mtimeMs < fs.statSync(path.join(raw, `chunk-${p.chunk}.mp3`)).mtimeMs);
if (todo.length) {
  const jobs = path.join(raw, 'jobs.json');
  fs.writeFileSync(jobs, JSON.stringify(todo.map((p) => ({audio: p.audio, out: p.words, hint: segs.find((s) => s.id === p.sid).spoken}))));
  const py = path.resolve('.venv-vo/Scripts/python.exe');
  if (!fs.existsSync(py)) throw new Error('Нет .venv-vo: python -m venv .venv-vo && .venv-vo/Scripts/python -m pip install faster-whisper');
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
