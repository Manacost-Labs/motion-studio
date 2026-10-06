// Рендерит контрольные кадры: node scripts/stills.mjs [--studio ads|features|youtube] [HearthPulseAd16x9] 30 125 200 ... [--safe]
// Студия по умолчанию — по id композиции (src/studios/studios.json: папка ролика или префикс), иначе ads. Кадры — out/stills/<id>/.
// --safe — для вертикали 9:16 рядом кладёт f<кадр>-safe.jpg: поверх кадра зоны интерфейса площадок, куда не ставить текст и
// главное (затемнено; рамки: красная — TikTok, синяя — Instagram Reels, жёлтая — YouTube Shorts). Зоны — ориентир по гайдам
// площадок (рамки кнопок, подписи, имени аккаунта); точное положение у площадок меняется — смотреть глазами.
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {ff} from './lib/media.mjs';
import {VIDEO} from './lib/paths.mjs';
import {bundleStudio, CHROME} from './lib/remotion.mjs';
import {studioOf} from './lib/studios.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const safe = args.includes('--safe');
if (safe) args.splice(args.indexOf('--safe'), 1);
const si = args.indexOf('--studio');
const studioArg = si < 0 ? undefined : args.splice(si, 2)[1];
const id = isNaN(Number(args[0])) ? args.shift() : 'HearthPulseAd';
const studio = studioArg ?? studioOf(id, 'ads').key;
const frames = args.map(Number);
const outDir = path.resolve('out/stills', id);
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundleStudio(studio);
const browserExecutable = CHROME;
const composition = await selectComposition({serveUrl, id, browserExecutable});

// Зоны интерфейса в кадре 1080×1920: [x, y, ширина, высота]
const SAFE = {
  TikTok: {color: 'red', zones: [[0, 0, 1080, 130], [0, 1436, 1080, 484], [940, 640, 140, 796], [0, 130, 60, 1306]]},
  Reels: {color: 'blue', zones: [[0, 0, 1080, 220], [0, 1500, 1080, 420], [960, 760, 120, 740]]},
  Shorts: {color: 'yellow', zones: [[0, 0, 1080, 160], [0, 1540, 1080, 380], [890, 820, 190, 720]]},
};
const vertical = composition.height > composition.width;
if (safe && !vertical) console.log(`--safe: ${id} не вертикальный (${composition.width}×${composition.height}) — зоны площадок 9:16 не накладываю`);

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(3, '0')}.jpg`);
  await renderStill({serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 85, scale: 0.5, browserExecutable});
  console.log(output);
  if (!safe || !vertical) continue;
  // зоны в масштабе кадра (кадр снят в половинном размере)
  const k = (composition.width * 0.5) / 1080;
  const box = (/** @type {number[]} */ [x, y, w, h]) => [x, y, w, h].map((v) => Math.round(v * k));
  const shade = Object.values(SAFE).flatMap((p) => p.zones.map((z) => `drawbox=${box(z).join(':')}:color=black@0.28:t=fill`));
  const lines = Object.values(SAFE).flatMap((p) => p.zones.map((z) => `drawbox=${box(z).join(':')}:color=${p.color}@0.9:t=2`));
  const marked = output.replace(/\.jpg$/, '-safe.jpg');
  ff(['-v', 'error', '-y', '-i', output, '-vf', [...shade, ...lines].join(','), '-q:v', '3', marked]);
  console.log(marked);
}
if (safe && vertical) console.log('зоны: красная — TikTok, синяя — Instagram Reels, жёлтая — YouTube Shorts; затемнено — интерфейс хотя бы одной площадки');
