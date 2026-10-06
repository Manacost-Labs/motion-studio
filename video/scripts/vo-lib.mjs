// Общее для озвучки YouTube-роликов (tts.mjs, vo-align.mjs, vo-fx.mjs, vo-takes.mjs, yt-qa.mjs): загрузка конфига ролика
// и подготовка текста диктора. Студия ролика — по его папке (scripts/lib/studios.mjs findVideo), cwd не важен.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {VIDEO} from './lib/paths.mjs';
import {findVideo, STUDIOS, studioDir} from './lib/studios.mjs';

// Словари произношения {как написано: как читать}, склеиваются по порядку (позже — главнее):
//   src/games/<игра>/data/pronounce.json — термины игры (имена, карты, сокращения; игра — поле game студии в studios.json);
//   src/studios/<студия>/pronounce.json — бренд-слова канала; pronounce в конфиге ролика — только его особые слова.
// Пополняются по предупреждениям yt-qa «термин звучит иначе». Тот же порядок — в проверке канала (channel.qa.pronounce → core/qa/audit.ts)
export const PRONOUNCE_FILE = path.join(studioDir('youtube'), 'pronounce.json');
export const gameDictionaryFile = (game) => path.join(VIDEO, 'src', 'games', game, 'data', 'pronounce.json');
const readDict = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
// dictionary() — словарь YouTube-студии Манакоста; dictionary('<ключ студии>' | '<id ролика>') — словарь его студии (игра + студия)
export const dictionary = (of) => {
  const key = !of ? 'youtube' : STUDIOS.some((s) => s.key === of) ? of : findVideo(of).key;
  const game = STUDIOS.find((s) => s.key === key).game;
  return {...(game ? readDict(gameDictionaryFile(game)) : {}), ...readDict(path.join(studioDir(key), 'pronounce.json'))};
};

// Конфиг ролика — TypeScript: собираем esbuild-ом в кэш и берём экспорт с нужным id. pronounce — словари игры и студии + слова ролика
export const loadConfig = async (id) => {
  const video = findVideo(id);
  const out = path.join(VIDEO, 'node_modules', '.cache', `vo-${id}.cjs`);
  await build({entryPoints: [video.configPath], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error'});
  const req = createRequire(import.meta.url);
  delete req.cache[out];
  const config = Object.values(req(out)).find((v) => v && typeof v === 'object' && v.id === id);
  if (!config) throw new Error(`В ${path.relative(VIDEO, video.configPath).replace(/\\/g, '/')} нет конфига с id «${id}»`);
  return {...config, pronounce: {...dictionary(video.key), ...config.pronounce}};
};

// Файл голоса сцены: <папка>/<сцена>.wav или .mp3 (если есть оба — более свежий) или null
export const voiceFile = (dir, seg, exts = ['wav', 'mp3']) => {
  const found = exts.map((e) => path.join(dir, `${seg}.${e}`)).filter((f) => fs.existsSync(f));
  return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
};

// Текст диктора → что говорим (с аудиотегами и заменами произношения) и что показываем (как написано).
// map[i] — диапазон [от, до) в произносимом тексте для i-го символа показываемого
export const speakable = (vo, pronounce = {}) => {
  const words = Object.keys(pronounce).sort((a, b) => b.length - a.length);
  const isWord = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  let spoken = '';
  let shown = '';
  const map = [];
  for (let i = 0; i < vo.length; ) {
    if (vo[i] === '[') {
      const j = vo.indexOf(']', i);
      if (j > i) {
        let k = j + 1;
        while (vo[k] === ' ') k++;
        spoken += vo.slice(i, k);
        i = k;
        continue;
      }
    }
    const w = words.find((w) => vo.startsWith(w, i) && !isWord(vo[i - 1]) && !isWord(vo[i + w.length]));
    if (w) {
      const from = spoken.length;
      spoken += pronounce[w];
      for (let k = 0; k < w.length; k++) {
        const a = from + Math.floor((k / w.length) * pronounce[w].length);
        const b = from + Math.max(1, Math.ceil(((k + 1) / w.length) * pronounce[w].length));
        map.push([a, b]);
        shown += vo[i + k];
      }
      i += w.length;
      continue;
    }
    map.push([spoken.length, spoken.length + 1]);
    spoken += vo[i];
    shown += vo[i];
    i++;
  }
  return {spoken, shown, map};
};

// ── Сопоставление распознанных слов с текстом (vo-align.mjs, yt-qa.mjs) ──
export const norm = (w) => w.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
export const tokens = (text) => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => ({w: norm(m[0]), a: m.index, b: m.index + m[0].length}));
export const lev = (a, b) => {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
export const sim = (a, b) => {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) return 0.6;
  return 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.7 ? 0.5 : -0.6;
};
// Выравнивание двух последовательностей слов (Нидлман — Вунш): для каждого слова текста — индекс распознанного или -1
export const align = (A, B) => {
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
export const readWords = (file) => {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(j) ? j : j.words ?? j.transcripts?.[0]?.words ?? j.transcript?.words;
  if (!list) throw new Error(`${file}: не нашёл список слов`);
  return list
    .filter((w) => (w.type ?? 'word') === 'word')
    .map((w) => ({w: norm(w.text ?? w.word), start: w.start ?? w.start_time, end: w.end ?? w.end_time, text: w.text ?? w.word}))
    .filter((w) => w.w);
};
