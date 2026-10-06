// Общее для скриптов, которые качают картинки карт из HearthstoneJSON (fetch-article.mjs, hs-assets.mjs)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';

export const HS = path.join(VIDEO, 'public', 'hs');

// База карт HearthstoneJSON (ruRU), кэш обновляется раз в сутки
const CACHE = path.join(VIDEO, 'node_modules', '.cache', 'hs-cards.ruRU.json');
export const cardDb = async () => {
  fs.mkdirSync(path.dirname(CACHE), {recursive: true});
  if (!fs.existsSync(CACHE) || Date.now() - fs.statSync(CACHE).mtimeMs > 24 * 3600e3) {
    const res = await fetch('https://api.hearthstonejson.com/v1/latest/ruRU/cards.json');
    fs.writeFileSync(CACHE, await res.text());
  }
  return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
};

// Код колоды (deckstring: base64 + varint) → формат, герои, карты [dbfId, количество] в порядке кода:
// сначала одиночные, потом парные, потом остальные
export const decodeDeck = (code) => {
  const b = Buffer.from(code, 'base64');
  let i = 1; // нулевой байт
  const v = () => {
    let r = 0;
    let s = 0;
    for (;;) {
      const x = b[i++];
      r |= (x & 0x7f) << s;
      if (!(x & 0x80)) return r >>> 0;
      s += 7;
    }
  };
  v(); // версия
  const format = v();
  const heroes = Array.from({length: v()}, v);
  const cards = [];
  for (const n of [1, 2]) for (let k = v(); k > 0; k--) cards.push([v(), n]);
  for (let k = v(); k > 0; k--) cards.push([v(), v()]);
  return {format, heroes, cards};
};

// Строка пикселей (оттенки серого) вдоль средней линии картинки
const midline = (file, vertical) => {
  const vf = vertical ? 'format=gray,crop=1:ih:iw/2:0' : 'format=gray,crop=iw:1:0:ih/2'; // в yuv420 полоса в 1 px не режется
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {maxBuffer: 1 << 20});
  return r.stdout;
};
// Границы содержимого; поле уже 6 px не считаем (светлый край самого арта), чтобы повторный прогон ничего не подрезал
const span = (px) => {
  let a = 0;
  let b = px.length - 1;
  while (a < b && px[a] >= 248) a++;
  while (b > a && px[b] >= 248) b--;
  if (a < 6) a = 0;
  if (px.length - 1 - b < 6) b = px.length - 1;
  return [a, b - a + 1];
};

// Арты новых карт HearthstoneJSON дополнены до квадрата белыми полями — обрезаем их
export const trimWhite = (file) => {
  const [x, w] = span(midline(file, false));
  const [y, h] = span(midline(file, true));
  const row = midline(file, false);
  if (w >= row.length - 2 && h >= midline(file, true).length - 2) return false;
  const tmp = file.replace(/\.jpg$/, '.trim.jpg');
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', `crop=${w}:${h}:${x}:${y}`, '-q:v', '2', tmp]);
  fs.renameSync(tmp, file);
  return true;
};

// У полосок для списка колоды (tiles) новых карт слева непрозрачный белый блок вместо прозрачного перехода,
// а справа бывает светлый столбик. Отрезаем их: остаётся только арт, переход рисует шаблон
export const trimTile = (file) => {
  const b = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 22}).stdout;
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout.trim();
  const [W, H] = probe.split(',').map(Number);
  const whiteShare = (x) => {
    let n = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      if (b[i + 3] > 200 && b[i] > 232 && b[i + 1] > 232 && b[i + 2] > 232) n++;
    }
    return n / H;
  };
  let left = 0;
  for (let x = 0; x < W * 0.6; x++) if (whiteShare(x) > 0.9) left = x + 1;
  let right = W;
  while (right > W - 8 && whiteShare(right - 1) > 0.4) right--;
  if (left === 0 && right === W) return false;
  const x0 = left ? left + 2 : 0; // пара пикселей запаса от края белого блока
  const tmp = file.replace(/\.png$/, '.trim.png');
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', `crop=${right - x0}:${H}:${x0}:0`, tmp]);
  fs.renameSync(tmp, file);
  return true;
};

// Некоторые русские рендеры карт HearthstoneJSON приходят на непрозрачном чёрном фоне (например, EDR_856).
// Тогда берём прозрачность у английского рендера той же карты: рамка и размер у них одинаковые
export const fixRenderAlpha = async (file, url) => {
  const corner = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=4:4:2:2', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']).stdout;
  if (corner[3] < 10) return false;
  const en = await fetch(url.replace('/ruRU/', '/enUS/'));
  if (!en.ok) return false;
  const enFile = file.replace(/\.png$/, '.en.png');
  const tmp = file.replace(/\.png$/, '.alpha.png');
  fs.writeFileSync(enFile, Buffer.from(await en.arrayBuffer()));
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-i', enFile, '-filter_complex', '[1]alphaextract[a];[0]format=rgb24[c];[c][a]alphamerge', tmp]);
  fs.rmSync(enFile);
  fs.renameSync(tmp, file);
  return true;
};

// Скачать, если файла ещё нет; арты и полоски сразу обрезать, у рендеров проверить прозрачность фона
export const download = async (url, rel) => {
  const file = path.join(HS, rel);
  if (fs.existsSync(file)) return 'есть';
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const r = await fetch(url);
  if (!r.ok) return `ошибка ${r.status}`;
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  if (rel.startsWith('art/')) trimWhite(file);
  if (rel.startsWith('tiles/')) trimTile(file);
  if (rel.startsWith('render/')) await fixRenderAlpha(file, url);
  return 'скачан';
};
