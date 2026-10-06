// Обложки ролика и лист читаемости: node scripts/yt-thumb.mjs <id>
// Рендерит все варианты обложки (config.thumb → <id>-thumb, config.thumbs → <id>-thumb-b, -c) в out/<id>/thumbnail.png,
// thumbnail-b.png, thumbnail-c.png и собирает out/<id>/thumbs-sheet.jpg: каждый вариант в 1280×720 и рядом так, как его
// видят в ленте и подсказках YouTube, — 320×180 и 168×94 на тёмной и светлой теме, с весом файла.
// Файл тяжелее 2 МБ (YouTube больше не примет) — ⚠ и рядом JPEG того же варианта. Выбор варианта — за человеком:
// все три можно загрузить в «Тест и сравнение».
import fs from 'node:fs';
import path from 'node:path';
import {renderStill, selectComposition} from '@remotion/renderer';
import {ff} from './lib/media.mjs';
import {VIDEO} from './lib/paths.mjs';
import {CHROME, openComposition, quietFonts} from './lib/remotion.mjs';
import {loadChannel} from './lib/channel.mjs';

process.chdir(VIDEO);
quietFonts();
const id = process.argv[2];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-thumb.mjs <id ролика>');
const {key, serveUrl, composition} = await openComposition(`${id}-thumb`, {fallback: 'youtube', logLevel: 'error'});
const {LIMITS} = await loadChannel(key, 'yt-thumb'); // пороги канала студии (channel.ts → LIMITS)
const {config} = /** @type {{config: any}} */ (composition.props);
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});

// варианты: A — thumb, B и C — thumbs (как регистрирует core/video/compositions.tsx)
const variants = [{key: 'A', comp: `${id}-thumb`, file: 'thumbnail.png'}, ...(config.thumbs ?? []).slice(0, LIMITS.thumbVariants - 1).map((_, i) => ({key: 'BC'[i], comp: `${id}-thumb-${'bc'[i]}`, file: `thumbnail-${'bc'[i]}.png`}))];
const MB = (b) => `${(b / 1024 / 1024).toFixed(2).replace('.', ',')} МБ`;
let warn = 0;
for (const v of variants) {
  const comp = v.comp === composition.id ? composition : await selectComposition({serveUrl, id: v.comp, browserExecutable: CHROME, logLevel: 'error'});
  v.png = path.join(outDir, v.file);
  await renderStill({serveUrl, composition: comp, output: v.png, imageFormat: 'png', browserExecutable: CHROME, logLevel: 'error'});
  v.bytes = fs.statSync(v.png).size;
  v.heavy = v.bytes > LIMITS.thumbBytes;
  if (v.heavy) {
    // тяжёлый PNG — JPEG того же варианта (на вид неотличим, весит в разы меньше)
    v.jpg = v.png.replace(/\.png$/, '.jpg');
    ff(['-v', 'error', '-y', '-i', v.png, '-q:v', '2', v.jpg]);
    v.jpgBytes = fs.statSync(v.jpg).size;
    warn++;
  }
  const t = /** @type {{config: any}} */ (comp.props).config.thumb; // вариант уже собран композицией (thumb + поля из thumbs)
  v.desc = `«${t.title.replace(/\n/g, ' ')}» · ${t.badge}${t.hook ? ` · печать «${t.hook}»` : ''} · ${t.cards.join(', ')}`;
}

// Лист: строка на вариант. Слева 1280×720, справа 320×180 и 168×94 — сверху на тёмной теме YouTube, снизу на светлой
const P = 32;
const W = P + 1280 + P + 320 + P + 168 + P;
const H = P + 720 + P;
const FONT = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, '’').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/%/g, '\\%');
const x2 = P + 1280 + P;
const x3 = x2 + 320 + P;
const rows = variants.map((v, i) => {
  const lines = [`Вариант ${v.key} — ${path.basename(v.png)}`, `PNG ${MB(v.bytes)}${v.heavy ? ` — тяжелее 2 МБ, загружать ${path.basename(v.jpg)} (${MB(v.jpgBytes)})` : ' — меньше 2 МБ'}`];
  const text = lines.map((l, k) => `drawtext=${FONT}:text='${esc(l)}':x=${x2}:y=${P + 180 + P + 180 + P + 20 + k * 34}:fontsize=22:fontcolor=${k && v.heavy ? '0xff8080' : 'white'}`).join(',');
  return (
    `color=c=0x0f0f0f:s=${W}x${H}[bg${i}];` +
    `[${i}:v]split=5[a${i}][m${i}][s${i}][m2${i}][s2${i}];` +
    `[m${i}]scale=320:180:flags=area[mm${i}];[s${i}]scale=168:94:flags=area[ss${i}];[m2${i}]scale=320:180:flags=area[mw${i}];[s2${i}]scale=168:94:flags=area[sw${i}];` +
    `[bg${i}][a${i}]overlay=${P}:${P}[r1${i}];[r1${i}][mm${i}]overlay=${x2}:${P}[r2${i}];[r2${i}][ss${i}]overlay=${x3}:${P}[r3${i}];` +
    `[r3${i}]drawbox=x=${x2 - P / 2}:y=${P + 180 + P / 2}:w=${320 + 168 + P * 2}:h=${180 + P}:color=white:t=fill[r4${i}];` +
    `[r4${i}][mw${i}]overlay=${x2}:${P + 180 + P}[r5${i}];[r5${i}][sw${i}]overlay=${x3}:${P + 180 + P}[r6${i}];` +
    `[r6${i}]${text}[row${i}]`
  );
});
const sheet = path.join(outDir, 'thumbs-sheet.jpg');
const stack = variants.length > 1 ? `;${variants.map((_, i) => `[row${i}]`).join('')}vstack=inputs=${variants.length}[out]` : ';[row0]null[out]';
ff(['-v', 'error', '-y', ...variants.flatMap((v) => ['-i', v.png]), '-filter_complex', rows.join(';') + stack, '-map', '[out]', '-frames:v', '1', '-q:v', '3', sheet]);

for (const v of variants) console.log(`${v.heavy ? '⚠️' : '✅'} ${v.key}: ${path.relative(process.cwd(), v.png)} — ${MB(v.bytes)}${v.heavy ? ` (> 2 МБ → ${path.basename(v.jpg)}, ${MB(v.jpgBytes)})` : ''}\n    ${v.desc}`);
console.log(`→ ${path.relative(process.cwd(), sheet)} — выбрать вариант по листу (лента 320×180, подсказки 168×94); все — в «Тест и сравнение»`);
process.exit(process.exitCode ?? 0);
