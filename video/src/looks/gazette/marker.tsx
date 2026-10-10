// Маркер читателя: полоса текстовыделителя под словом или строкой — край от руки (неровный SVG-контур, шум с постоянным
// зерном), проводится слева направо маской за MARK_DRAW кадров, когда текст уже встал и прочитан, дальше неподвижна.
// Одна пометка за раз и не больше одной на полосе: это акцент, а не раскраска.
// По мотивам Vincentwei1021/video-shotcraft, demos/typography/marker-underline-title/MarkerUnderlineTitle.tsx (Apache-2.0):
// оттуда — контур «переменная толщина + шершавый край + лёгкий подъём к концу», раскрытие слева направо с быстрым стартом
// и правило «пометка — после того, как текст встал». У нас — полупрозрачная охра под текстом (выделитель, а не черта),
// край — @remotion/noise вместо генератора случайных чисел, время — «кадры-30» (core/time/fps.ts)
import React from 'react';
import {Easing, interpolate} from 'remotion';
import {noise2D} from '@remotion/noise';
import {useFrame} from '../../core/time/fps';
import {clamp} from '../../core/time/ease';
import {G, MARKER_ALPHA} from './theme';

export const MARK_DRAW = 10; // кадров на проведение: дольше 14 читается как полоса загрузки, короче 6 — не видно руки
const DRAW_EASE = Easing.out(Easing.poly(2.2)); // рука: быстрый старт, к концу чуть медленнее

const VB_H = 100; // высота контура в единицах viewBox; ширина — VB_H × ratio

// Контур полосы: верхний и нижний край — шумом со своим зерном; середина чуть поднимается к концу (рука тянет вверх),
// толщина ровная, к хвосту стержень сходит; начало срезано наискось, как у скошенного стержня
const stroke = (ratio: number, seed: number) => {
  const w = VB_H * ratio;
  const n = Math.max(24, Math.round(ratio * 16));
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = t * w;
    const mid = 52 - 6 * t + 4 * noise2D(`${seed}m`, t * 1.4, 0);
    const half = 38 + 3 * noise2D(`${seed}w`, t * 2.5, 0) - Math.max(0, t - 0.92) * 280;
    // шершавость: крупная волна и мелкая, у каждого края своя
    const rough = (k: string) => 3.5 * noise2D(`${seed}${k}`, x / 38, 0) + 1.6 * noise2D(`${seed}${k}2`, x / 11, 0);
    top.push(`${(x + (i === 0 ? 7 : 0)).toFixed(1)},${(mid - half + rough('t')).toFixed(1)}`);
    bot.push(`${(x - (i === 0 ? 3 : 0)).toFixed(1)},${(mid + half + rough('b')).toFixed(1)}`);
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`;
};

// Пометка под текстом children. at — кадр начала (текст к этому времени уже стоит); seed — зерно края (у соседних пометок
// разное); ratio — ширина полосы к высоте: по умолчанию — по длине строки, если children — строка
export const Marker: React.FC<{at: number; seed?: number; ratio?: number; children: React.ReactNode}> = ({at, seed = 1, ratio, children}) => {
  const f = useFrame();
  const p = interpolate(f, [at, at + MARK_DRAW], [0, 1], {...clamp, easing: DRAW_EASE});
  const r = ratio ?? (typeof children === 'string' ? Math.max(2, (children.length * 0.5 + 0.4) / 0.7) : 6);
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {p > 0 ? (
        <svg
          viewBox={`0 0 ${VB_H * r} ${VB_H}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            left: '-0.2em',
            top: '0.3em',
            width: 'calc(100% + 0.4em)',
            height: '0.74em',
            overflow: 'visible',
            // маска уходит вправо; когда полоса проведена, маски нет — кадры дальше неподвижны
            clipPath: p < 1 ? `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)` : undefined,
          }}
        >
          <path d={stroke(r, seed)} fill={G.marker} opacity={MARKER_ALPHA * Math.min(1, p * 4)} />
        </svg>
      ) : null}
      <span style={{position: 'relative'}}>{children}</span>
    </span>
  );
};
