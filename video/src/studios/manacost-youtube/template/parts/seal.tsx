// Сургучная печать места для топ-3: оттиск с номером ложится на угол постера, как печать на документе. Опускается
// сверху с ускорением (тень от большой и мягкой к короткой и плотной), в момент удара чуть сплющивается и встаёт
// под лёгким наклоном; глухой стук — seal-stamp (scripts/foley.mjs). Красный сургуч, у №1 — золотой.
// По кругу — надпись оттиска (ring), номер выдавлен: светлый край сверху-слева, тёмный оттиск
import React from 'react';
import {interpolate} from 'remotion';
import {DISPLAY} from '../../brand';
import {EASE_IN, ramp, TEXT} from '../theme';
import {useFrame} from '../fps';

export const SEAL_DROP = 8; // кадров от появления до удара

const WAX = {
  red: {hi: '#d9545a', mid: '#a3202a', lo: '#6e0f14', deep: '#4f080c'},
  gold: {hi: '#fff0b8', mid: '#e2b24c', lo: '#a06f18', deep: '#6e4a0c'},
};

// край сургуча: неровный круг из нескольких волн
const blob = (R: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 160; i++) {
    const th = (i / 160) * Math.PI * 2;
    const r = R + 3.6 * Math.sin(5 * th + 1) + 2.6 * Math.sin(9 * th + 2.3) + 1.8 * Math.sin(14 * th + 0.4);
    pts.push(`${(r * Math.cos(th)).toFixed(2)},${(r * Math.sin(th)).toFixed(2)}`);
  }
  return `M ${pts.join(' L ')} Z`;
};
const EDGE = blob(90);

export const WaxSeal: React.FC<{rank: number; at: number; x: number; y: number; size?: number; gold?: boolean; ring?: string}> = ({rank, at, x, y, size = 176, gold = false, ring}) => {
  const f = useFrame();
  if (f < at) return null;
  const d = ramp(f, at, at + SEAL_DROP, EASE_IN); // опускается
  const hit = interpolate(f, [at + SEAL_DROP, at + SEAL_DROP + 3, at + SEAL_DROP + 9], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const up = 1 - d;
  const w = gold ? WAX.gold : WAX.red;
  const id = `wax-${rank}-${gold ? 'g' : 'r'}`;
  const text = (ring ?? (gold ? 'Лидер меты · ' : 'Топ-3 · Манакост · ')).toUpperCase();
  const reps = Math.max(1, Math.round(38 / text.length)); // ~38 знаков по кругу — плотно, но без слипания
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        scale: `${1 + 0.5 * up + 0.05 * hit} ${1 + 0.5 * up - 0.05 * hit}`,
        rotate: `${-16 + 8 * d}deg`,
        opacity: Math.min(1, d * 6),
        filter: `drop-shadow(0 ${4 + 26 * up}px ${5 + 22 * up}px rgba(40,10,5,${0.5 - 0.25 * up}))`,
      }}
    >
      <svg viewBox="-100 -100 200 200" width={size} height={size} style={{overflow: 'visible'}}>
        <defs>
          <radialGradient id={`${id}-fill`} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={w.hi} />
            <stop offset="45%" stopColor={w.mid} />
            <stop offset="100%" stopColor={w.lo} />
          </radialGradient>
          <radialGradient id={`${id}-press`} cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor={w.lo} stopOpacity={0} />
            <stop offset="100%" stopColor={w.deep} stopOpacity={0.55} />
          </radialGradient>
          <path id={`${id}-ring`} d="M 0,-75 A 75,75 0 1,1 -0.01,-75" />
        </defs>
        <path d={EDGE} fill={`url(#${id}-fill)`} />
        {/* вдавленный диск оттиска: тёмный край внутри, светлый блик по верхней кромке */}
        <circle r={66} fill={`url(#${id}-press)`} />
        <circle r={66} fill="none" stroke={w.deep} strokeWidth={3.5} opacity={0.65} />
        <circle r={64} fill="none" stroke={w.hi} strokeWidth={1.4} opacity={0.5} transform="translate(-1.2 -1.2)" />
        <text fontFamily={TEXT} fontWeight={800} fontSize={12.5} fill={w.deep} opacity={0.8}>
          <textPath href={`#${id}-ring`} textLength={462} lengthAdjust="spacing">
            {text.repeat(reps)}
          </textPath>
        </text>
        <text x={-2} y={-2} textAnchor="middle" dominantBaseline="central" fontFamily={DISPLAY} fontSize={rank >= 10 ? 70 : 86} fill={w.hi} opacity={0.55}>
          {rank}
        </text>
        <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontFamily={DISPLAY} fontSize={rank >= 10 ? 70 : 86} fill={w.deep}>
          {rank}
        </text>
        {/* блик на сургуче */}
        <ellipse cx={-34} cy={-44} rx={30} ry={14} fill="#fff" opacity={0.16} transform="rotate(-32 -34 -44)" />
      </svg>
    </div>
  );
};
