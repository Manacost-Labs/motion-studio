// План камеры над постером колоды (blizzcore): куда и когда камера наезжает под голос, какие карты приподнимаются,
// как обходит постер в паузах. Чистые данные — их рисует сцена колоды (games/hearthstone/scenes/parts/posterCam.tsx)
// и считает проверка простоев (games/hearthstone/data/audit.ts). Время — в «кадрах-30»
import {cardRect, posterGeom} from './poster';
import type {DeckPosterData} from './types';

const ZIN = 26; // кадров на наезд
const ZOUT = 30; // на отъезд
const HOLD = 100; // сколько держим карту, если следующая не звучит раньше
const ZOOM = 2.4;
const TOUR_MIN = 75; // карты не звучат дольше 2,5 с — камера медленно обходит постер: в кадре всегда есть движение
const TOUR_LONG = 160; // в длинной паузе — по трём точкам, в короткой — к одной и обратно
const TOUR_ZOOM = 1.55;
export const MARGIN = 120; // камера может чуть заходить за край постера — крайняя карта не прижимается к рамке

export type Focus = {fx: number; fy: number; z: number};
export type Key = Focus & {f: number};
export type PosterPlan = {keys: Key[]; lifts: {idx: number; a: number; b: number; ink?: boolean}[]; moves: [number, number][]};

// План камеры по моментам, когда звучат карты (at). Карты, которых нет на постере, пропускаются.
// view — размер окна постера на экране: точки, куда едет камера, заранее зажимаются в границы кадра (не дальше MARGIN
// за край постера). Зажимать нужно точки, а не каждый кадр: иначе у края камера стоит на упоре, а потом срывается рывком
export const planCamera = (p: DeckPosterData, cards: {id: string; at: number; ink?: boolean}[], dur: number, view?: {w: number; h: number}): PosterPlan => {
  const OV: Focus = {fx: p.w / 2, fy: p.h / 2, z: 1};
  const fit = (F: Focus): Focus => {
    if (!view) return F;
    const sc = (view.w / p.w) * F.z;
    const mx = Math.min(p.w / 2, (view.w / 2 - MARGIN) / sc);
    const my = Math.min(p.h / 2, (view.h / 2 - MARGIN) / sc);
    return {...F, fx: Math.min(p.w - mx, Math.max(mx, F.fx)), fy: Math.min(p.h - my, Math.max(my, F.fy))};
  };
  const inDeck = cards.map((c) => ({...c, idx: p.order.indexOf(c.id)})).filter((c) => c.idx >= 0);
  const keys: Key[] = [{f: 0, ...OV}];
  const lifts: PosterPlan['lifts'] = [];
  const moves: [number, number][] = [];
  let cur = OV;
  let t = 0;
  inDeck.forEach((c, i) => {
    const r = cardRect(p, c.idx);
    const target = fit({fx: r.cx, fy: r.cy, z: ZOOM});
    const s = Math.max(t + 1, c.at - 12);
    if (s + ZIN > dur - 10) return;
    keys.push({f: s, ...cur}, {f: s + ZIN, ...target});
    moves.push([s, s + ZIN]);
    const arrive = s + ZIN;
    const next = inDeck[i + 1];
    const nextStart = next ? next.at - 12 : Infinity;
    let end = Math.min(arrive + HOLD, nextStart, dur - 10 - ZOUT);
    end = Math.max(end, arrive + 24);
    lifts.push({idx: c.idx, a: arrive - 12, b: end, ink: c.ink});
    cur = target;
    t = end;
    // следующая карта скоро — едем прямо к ней, иначе отъезжаем к общему плану
    if (!(next && nextStart - end < ZOUT + 24) && end + ZOUT <= dur - 6) {
      keys.push({f: end, ...cur}, {f: end + ZOUT, ...OV});
      moves.push([end, end + ZOUT]);
      cur = OV;
      t = end + ZOUT;
    }
  });
  // Обход: пока карты не звучат дольше TOUR_MIN, камера медленно проходит по постеру (до трёх точек, лёгкий зум)
  // и к следующей названной карте возвращается на общий план. Медленно — без размытия в движении
  const rests: [number, number][] = [];
  keys.forEach((k, i) => {
    const next = keys[i + 1];
    const atOV = k.z === 1 && k.fx === OV.fx && k.fy === OV.fy;
    if (atOV && (!next || (next.z === 1 && next.fx === OV.fx && next.fy === OV.fy))) rests.push([k.f, next ? next.f : dur - 10]);
  });
  rests.forEach(([a, b], n) => {
    const a0 = Math.max(a + 15, 40);
    const len = b - a0;
    if (len < TOUR_MIN) return;
    const rows = Math.ceil(p.order.length / posterGeom(p.w, p.h).cols);
    const top = cardRect(p, 0);
    const low = cardRect(p, Math.min(p.order.length - 1, (rows - 1) * posterGeom(p.w, p.h).cols));
    const mid = (top.cy + low.cy) / 2;
    const P1 = fit({fx: p.w * 0.3, fy: top.cy, z: TOUR_ZOOM});
    const P2 = fit({fx: p.w * 0.68, fy: mid, z: TOUR_ZOOM});
    const P3 = fit({fx: p.w * 0.36, fy: low.cy, z: TOUR_ZOOM});
    const path = n % 2 ? [P3, P2, P1] : [P1, P2, P3];
    const last = !keys.some((k) => k.f > a); // хвост сцены — к общему плану не возвращаемся
    const end = last ? b : b - Math.min(40, len * 0.18);
    keys.push({f: a0, ...OV});
    if (len < TOUR_LONG) keys.push({f: a0 + (end - a0) * 0.6, ...path[n % 3]});
    else path.forEach((P, k) => keys.push({f: a0 + ((end - a0) * (k + 1)) / 3, ...P}));
    if (!last) keys.push({f: b, ...OV});
  });
  keys.sort((x, y) => x.f - y.f);
  return {keys, lifts, moves};
};
