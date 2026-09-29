// Точная раскладка карт на постере api.blizzcore.ru. Для каждой ячейки постера находит, какая карта там лежит
// (среди карт той же стоимости: внутри одной стоимости сервис иногда ставит карты не в порядке кода колоды),
// и её прямоугольник — сравнением с рендером HearthstoneJSON по непрозрачным пикселям (минимум разницы цвета).
//   node scripts/poster-fit.mjs <папка ролика в src/studios/manacost-youtube> [место]
// Переписывает в article.json у poster: order, types, rarities (в порядке постера) и rects — [x, y, w, h] рендера
// в пикселях постера. По rects шаблон кладёт поверх постера резкие рендеры карт и наводит камеру.
import fs from 'node:fs';
import path from 'node:path';
import {studioDir} from './studios.mjs';
import {spawnSync} from 'node:child_process';
import {cardDb, decodeDeck} from './hs-lib.mjs';

// сетки постеров: шаг ячеек и примерное положение рендера существа в первой ячейке (см. src/studios/manacost-youtube/template/poster.ts)
const GRID = {
  8: {cols: 8, dx: 235, dy: 328, s: 0.4601, ox: 25.3, oy: -9},
  6: {cols: 6, dx: 313, dy: 426, s: 0.6157, ox: 26.9, oy: -20},
};

const raw = (file, vf, fmt) => spawnSync('ffmpeg', ['-v', 'error', '-i', file, ...(vf ? ['-vf', vf] : []), '-f', 'rawvideo', '-pix_fmt', fmt, '-'], {maxBuffer: 1 << 28}).stdout;
const dims = (file) => spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout.trim().split(',').map(Number);

// Рендер карты, заранее уменьшенный до примерного масштаба постера; непрозрачные точки с шагом step
const renderCache = new Map();
const loadRender = (id, s0) => {
  const key = `${id}@${s0}`;
  if (renderCache.has(key)) return renderCache.get(key);
  const file = `public/hs/render/${id}.png`;
  const [rw, rh] = dims(file);
  const w = Math.round(rw * s0);
  const h = Math.round(rh * s0);
  const px = raw(file, `scale=${w}:${h}:flags=area`, 'rgba');
  const pts = (step) => {
    const out = [];
    for (let y = 1; y < h - 1; y += step)
      for (let x = 1; x < w - 1; x += step) {
        const i = (y * w + x) * 4;
        if (px[i + 3] > 230) out.push(x, y, px[i], px[i + 1], px[i + 2]);
      }
    return out;
  };
  const r = {rw, rh, w, h, coarse: pts(7), fine: pts(2)};
  renderCache.set(key, r);
  return r;
};

// средняя разница цвета: рендер с масштабом m (от уже уменьшенного) и левым верхом (x, y) против постера
const errAt = (P, PW, PH, pts, x, y, m) => {
  let sum = 0;
  let n = 0;
  for (let k = 0; k < pts.length; k += 5) {
    const fx = x + pts[k] * m;
    const fy = y + pts[k + 1] * m;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 >= PW - 1 || y0 >= PH - 1) continue;
    const ax = fx - x0;
    const ay = fy - y0;
    const i00 = (y0 * PW + x0) * 3;
    const i10 = i00 + 3;
    const i01 = i00 + PW * 3;
    const i11 = i01 + 3;
    for (let c = 0; c < 3; c++) {
      const v = (P[i00 + c] * (1 - ax) + P[i10 + c] * ax) * (1 - ay) + (P[i01 + c] * (1 - ax) + P[i11 + c] * ax) * ay;
      sum += Math.abs(v - pts[k + 2 + c]);
    }
    n++;
  }
  return n ? sum / n : Infinity;
};

// Грубый поиск вокруг ячейки, затем уточнение с шагом полпикселя
const fitCard = (P, PW, PH, g, slot, id) => {
  const R = loadRender(id, g.s);
  const gx = g.ox + (slot % g.cols) * g.dx;
  const gy = g.oy + Math.floor(slot / g.cols) * g.dy;
  let best = {err: Infinity};
  for (let m = 0.9; m <= 1.1001; m += 0.01)
    for (let dy = -28; dy <= 28; dy += 2)
      for (let dx = -28; dx <= 28; dx += 2) {
        const e = errAt(P, PW, PH, R.coarse, gx + dx, gy + dy, m);
        if (e < best.err) best = {err: e, x: gx + dx, y: gy + dy, m};
      }
  const c = best;
  for (let m = c.m - 0.012; m <= c.m + 0.0121; m += 0.002)
    for (let dy = -2.5; dy <= 2.5; dy += 0.5)
      for (let dx = -2.5; dx <= 2.5; dx += 0.5) {
        const e = errAt(P, PW, PH, R.fine, c.x + dx, c.y + dy, m);
        if (e < best.err || best === c) best = {err: e, x: c.x + dx, y: c.y + dy, m};
      }
  const s = g.s * best.m * (R.w / (R.rw * g.s)); // точный масштаб от исходного рендера
  return {id, err: best.err, rect: [best.x, best.y, R.rw * s, R.rh * s].map((v) => Math.round(v * 10) / 10)};
};

// Быстрая проверка «эта ли карта в ячейке»: редкие точки, шаг 4 px, три масштаба
const quickErr = (P, PW, PH, g, slot, id) => {
  const R = loadRender(id, g.s);
  const gx = g.ox + (slot % g.cols) * g.dx;
  const gy = g.oy + Math.floor(slot / g.cols) * g.dy;
  let best = Infinity;
  for (const m of [0.94, 1, 1.04])
    for (let dy = -24; dy <= 24; dy += 4) for (let dx = -24; dx <= 24; dx += 4) best = Math.min(best, errAt(P, PW, PH, R.coarse, gx + dx, gy + dy, m));
  return best;
};

// Какая карта в какой ячейке: жадно берём самые уверенные пары «ячейка — карта»
const assign = (E) => {
  const pairs = [];
  E.forEach((row, i) => row.forEach((e, j) => pairs.push([e, i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const bySlot = new Map();
  const used = new Set();
  for (const [, i, j] of pairs) {
    if (bySlot.has(i) || used.has(j)) continue;
    bySlot.set(i, j);
    used.add(j);
  }
  return E.map((_, i) => bySlot.get(i));
};

const [folder, only] = process.argv.slice(2);
if (!folder) throw new Error('node scripts/poster-fit.mjs <папка ролика> [место]');
const file = path.join(studioDir('youtube'), folder, 'article.json');
const article = JSON.parse(fs.readFileSync(file, 'utf8'));
const byDbf = new Map((await cardDb()).map((c) => [c.dbfId, c]));
const byId = new Map([...byDbf.values()].map((c) => [c.id, c]));

for (const d of article.decks) {
  if (!d.poster || (only && String(d.rank) !== only)) continue;
  const p = d.poster;
  const g = GRID[p.h / p.w > 0.85 ? 6 : 8];
  const P = raw(path.resolve('public', p.src), null, 'rgb24');
  // сервис сортирует по стоимости, но связанные карты (молот и облик Мурадина и т. п.) ставит сразу за владельцем,
  // поэтому ячейку сверяем со всеми картами колоды
  const ids = decodeDeck(d.code).cards.map(([dbf]) => byDbf.get(dbf).id);
  const E = ids.map((_, slot) => ids.map((id) => quickErr(P, p.w, p.h, g, slot, id)));
  const fits = assign(E).map((j, slot) => fitCard(P, p.w, p.h, g, slot, ids[j]));
  const moved = fits.filter((f, i) => f.id !== p.order[i]).length;
  p.order = fits.map((f) => f.id);
  p.types = p.order.map((id) => byId.get(id).type);
  p.rarities = p.order.map((id) => byId.get(id).rarity ?? null);
  p.rects = fits.map((f) => f.rect);
  if (process.env.VERBOSE) fits.forEach((f, i) => console.log(`   ${String(i).padStart(2)} ${f.id.padEnd(14)} ${p.types[i].padEnd(8)} ${f.err.toFixed(1).padStart(6)}  [${f.rect.join(', ')}]`));
  const worst = fits.reduce((a, b) => (b.err > a.err ? b : a));
  console.log(`${String(d.rank).padStart(2)}. ${d.name}: ${fits.length} карт, переставлено ${moved}, худшее совпадение ${worst.err.toFixed(1)} (${worst.id})`);
}
fs.writeFileSync(file, JSON.stringify(article, null, 1));
