// Геометрия постеров колод api.blizzcore.ru (ширина 1920). Карта на постере — рендер HearthstoneJSON 512×776,
// уменьшенный до s; левый верх холста карты с индексом i: (ox + col·dx, oy + row·dy), col = i % cols.
// Две сетки: 8 колонок (постер ~1920×1483, 19–24 разных карты) и 6 колонок (~1920×1775, до 18 карт).
// Сервис вписывает рамку карты в ячейку, поэтому у существ, заклинаний и легендарок (рамка с драконом крупнее)
// масштаб и сдвиг чуть разные. Значения подобраны scripts/calib-poster.mjs и проверены наложением (yt-poster-calib-*).
export type Fit = {s: number; ox: number; oy: number};
export type PosterGeom = {cols: number; dx: number; dy: number; spell: Fit; minion: Fit; legendSpell: Fit; legendMinion: Fit};

export const POSTER_8: PosterGeom = {
  cols: 8,
  dx: 235,
  dy: 328,
  spell: {s: 0.4738, ox: 21.3, oy: -15},
  minion: {s: 0.4601, ox: 25.3, oy: -9},
  legendSpell: {s: 0.468, ox: 10.4, oy: -12.8}, // пересчитано из 6-колоночной сетки
  legendMinion: {s: 0.4405, ox: 28, oy: 3},
};
export const POSTER_6: PosterGeom = {
  cols: 6,
  dx: 313,
  dy: 426,
  spell: {s: 0.636, ox: 21.5, oy: -27},
  minion: {s: 0.6157, ox: 26.9, oy: -20},
  legendSpell: {s: 0.6284, ox: 6.9, oy: -24},
  legendMinion: {s: 0.5895, ox: 30.5, oy: -4},
};

export const posterGeom = (w: number, h: number): PosterGeom => (h / w > 0.85 ? POSTER_6 : POSTER_8);

// Прямоугольник холста карты и её центр в координатах постера
export const posterCard = (g: PosterGeom, idx: number, type?: string, rarity?: string | null) => {
  const legend = rarity === 'LEGENDARY';
  const minion = type === 'MINION';
  const fit = legend ? (minion ? g.legendMinion : g.legendSpell) : minion ? g.minion : g.spell;
  const col = idx % g.cols;
  const row = Math.floor(idx / g.cols);
  const x = fit.ox + col * g.dx;
  const y = fit.oy + row * g.dy;
  const w = 512 * fit.s;
  const h = 776 * fit.s;
  return {x, y, w, h, cx: x + 244 * fit.s, cy: y + 378 * fit.s};
};

// Прямоугольник карты с индексом idx: точный из poster-fit (rects), иначе по сетке. Центр — середина рамки карты
// (в холсте рендера 512×776 она чуть левее и выше середины)
export const cardRect = (p: {w: number; h: number; types?: string[]; rarities?: (string | null)[]; rects?: number[][]}, idx: number) => {
  const r = p.rects?.[idx];
  if (!r) return posterCard(posterGeom(p.w, p.h), idx, p.types?.[idx], p.rarities?.[idx]);
  const [x, y, w, h] = r;
  return {x, y, w, h, cx: x + (w * 244) / 512, cy: y + (h * 378) / 776};
};
