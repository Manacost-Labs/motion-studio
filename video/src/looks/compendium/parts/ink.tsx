// Пометка пером на постере: красные чернила от руки обводят карту — наклонённый неровный овал чуть больше полного
// оборота (конец заходит за начало, как при быстром росчерке), рисуется за полсекунды и держится, пока камера на карте;
// когда камера уходит (out), чернила гаснут. Лежит в координатах
// постера: толщина линии — как у пера на бумаге, при наезде камеры растёт вместе с постером. Чернила ложатся
// «умножением» — карта под линией просвечивает, как через настоящие чернила. Звук пера — в сцене колоды (games/hearthstone/scenes/deck.tsx):
// слой постера при движении камеры рисуется копиями для размытия, звук внутри него задвоился бы
import React from 'react';
import {EASE_IN_OUT, H, ramp} from '../theme';
import {useFrame} from '../../../core/time/fps';

const DRAW = 16; // кадров на росчерк

// Росчерк от руки вокруг прямоугольника: наклонённый «яйцевидный» овал с неровным краем, спираль наружу — конец
// заходит за начало на ~15 % и не ложится на него; чуть плотнее карты (поднятая карта может выйти углом — как у живой руки)
const loop = (r: {x: number; y: number; w: number; h: number}, seed: number) => {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w * 0.7;
  const ry = r.h * 0.64;
  const tilt = -0.14 + ((seed * 37) % 7) * 0.02; // наклон руки
  const t0 = -Math.PI * 0.7 + (seed % 5) * 0.21;
  const N = 140;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const q = i / N;
    const th = t0 + q * Math.PI * 2 * 1.15;
    const wob = 1 + 0.045 * Math.sin(2 * th + seed * 1.3) + 0.025 * Math.sin(5 * th + seed) + 0.012 * Math.sin(11 * th + seed * 2.1);
    const grow = 1 + 0.08 * q;
    const x = rx * wob * grow * Math.cos(th);
    const y = ry * wob * grow * Math.sin(th);
    pts.push(`${(cx + x * Math.cos(tilt) - y * Math.sin(tilt)).toFixed(1)},${(cy + x * Math.sin(tilt) + y * Math.cos(tilt)).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
};

// нажим пера: тонкий след по всей линии и толще в середине (с 8 % до 82 % пути) — хвосты сходят на нет
const PRESS = [0.08, 0.82];

const FADE = 14; // кадров на угасание

export const InkCircle: React.FC<{r: {x: number; y: number; w: number; h: number}; at: number; out?: number; seed?: number; width?: number}> = ({r, at, out, seed = 0, width = 14}) => {
  const f = useFrame();
  const gone = out === undefined ? 0 : ramp(f, out - 4, out - 4 + FADE, EASE_IN_OUT);
  if (f < at || gone >= 1) return null;
  const p = ramp(f, at, at + DRAW, EASE_IN_OUT);
  const d = loop(r, seed);
  const pad = r.w; // запас холста вокруг карты: овал выходит за её края
  const press = Math.max(0, Math.min(p, PRESS[1]) - PRESS[0]);
  const line = {d, pathLength: 1, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round'} as const;
  return (
    <svg
      style={{position: 'absolute', left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2, overflow: 'visible', mixBlendMode: 'multiply', pointerEvents: 'none', opacity: 1 - gone}}
      viewBox={`${r.x - pad} ${r.y - pad} ${r.w + pad * 2} ${r.h + pad * 2}`}
    >
      <path {...line} stroke={H.red} strokeWidth={width * 0.5} strokeDasharray="1 1" strokeDashoffset={1 - p} opacity={0.9} />
      {press > 0 && <path {...line} stroke={H.red} strokeWidth={width} strokeDasharray={`${press} 2`} strokeDashoffset={-PRESS[0]} opacity={0.75} />}
      {/* тёмный след внутри — чернила легли неравномерно */}
      {press > 0 && <path {...line} stroke={H.redDark} strokeWidth={width * 0.3} strokeDasharray={`${press} 2`} strokeDashoffset={-PRESS[0]} opacity={0.5} transform="translate(1.5 1)" />}
    </svg>
  );
};
