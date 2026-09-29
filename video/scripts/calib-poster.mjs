// Калибровка геометрии постеров api.blizzcore.ru: для нескольких карт подбирает масштаб и сдвиг рендера
// HearthstoneJSON (512×776), при которых он лучше всего совпадает с картой на постере (минимум разницы пикселей).
//   node scripts/calib-poster.mjs <папка ролика> <место колоды> <индексы карт через запятую>
// Печатает для каждой карты sx, sy и левый верх холста → по ним обновляются POSTER_8 / POSTER_6 в src/studios/manacost-youtube/template/poster.ts
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {studioDir} from './studios.mjs';

const [folder, rank, list] = process.argv.slice(2);
const article = JSON.parse(fs.readFileSync(path.join(studioDir('youtube'), folder, 'article.json'), 'utf8'));
const deck = article.decks.find((d) => String(d.rank) === rank);
const {src, w: PW, h: PH, order} = deck.poster;
const six = PH / PW > 0.85;
const g = six ? {cols: 6, s: 0.638, ox: 26.9, oy: -16, dx: 313, dy: 426} : {cols: 8, s: 0.4578, ox: 25.3, oy: -21, dx: 235, dy: 328};

const P = spawnSync('ffmpeg', ['-v', 'error', '-i', path.resolve('public', src), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1 << 26}).stdout;
const scaled = (id, w, h) =>
  spawnSync('ffmpeg', ['-v', 'error', '-i', `public/hs/render/${id}.png`, '-vf', `scale=${w}:${h}:flags=bicubic`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 24}).stdout;

for (const idx of list.split(',').map(Number)) {
  const id = order[idx];
  const col = idx % g.cols;
  const row = Math.floor(idx / g.cols);
  const gx = g.ox + col * g.dx;
  const gy = g.oy + row * g.dy;
  let best = {err: Infinity};
  for (let s = g.s * 0.94; s <= g.s * 1.06; s += g.s * 0.005)
    for (const r of [1, 1.02, 1.04, 1.06]) {
      const w = Math.round(512 * s);
      const h = Math.round(776 * s * r);
      const R = scaled(id, w, h);
      for (let dy = -24; dy <= 24; dy += 2)
        for (let dx = -24; dx <= 24; dx += 2) {
          let err = 0;
          let n = 0;
          for (let y = 0; y < h; y += 3)
            for (let x = 0; x < w; x += 3) {
              const ri = (y * w + x) * 4;
              if (R[ri + 3] < 200) continue;
              const px = Math.round(gx + dx + x);
              const py = Math.round(gy + dy + y);
              if (px < 0 || py < 0 || px >= PW || py >= PH) continue;
              const pi = (py * PW + px) * 3;
              err += Math.abs(R[ri] - P[pi]) + Math.abs(R[ri + 1] - P[pi + 1]) + Math.abs(R[ri + 2] - P[pi + 2]);
              n++;
            }
          const e = err / Math.max(1, n);
          if (e < best.err) best = {err: e, s, r, x: gx + dx, y: gy + dy, w, h};
        }
    }
  console.log(`${idx} ${id}: sx ${best.s.toFixed(4)} sy ${(best.s * best.r).toFixed(4)} холст (${best.x.toFixed(1)}, ${best.y.toFixed(1)}) → ox ${(best.x - col * g.dx).toFixed(1)} oy ${(best.y - row * g.dy).toFixed(1)}; ошибка ${best.err.toFixed(1)}`);
}
