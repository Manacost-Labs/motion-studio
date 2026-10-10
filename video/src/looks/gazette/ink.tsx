// Смена полосы «чернилами»: новая полоса проступает пятном с неровным, как у растёкшейся краски, краем — из одной точки
// за INK_DUR кадров (1,2 с), быстро, потом медленнее и неравномерно по направлениям (лепестки по шуму, край меняется плавно,
// без мерцания). Край виден только по тонкой мягкой линии чуть темнее бумаги (2 px) — без колец, полос и брызг.
// Как только пятно закрыло кадр, маска и линия снимаются совсем: дальше полоса — обычный неподвижный слой (эталоны SSIM не шумят).
// По мотивам Vincentwei1021/video-shotcraft, demos/transition/print-texture-transitions/InkBleedReveal.tsx (Apache-2.0):
// оттуда — маска-клякса из точки, рост «быстро → медленно» с неровной скоростью, постоянное зерно, снятие маски после
// заливки. У нас вместо SVG-фильтров (feTurbulence + feDisplacementMap над foreignObject) — многоугольник clip-path,
// край которого считает @remotion/noise: рендер быстрее, край не дрожит на субпикселях. Проба 10.10 со сплошной кляксой
// краски, закрывающей кадр, отброшена по кадрам: полсекунды чёрного экрана на светлой газете — провал в черноту
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useVideoConfig} from 'remotion';
import {noise3D} from '@remotion/noise';
import {useFrame} from '../../core/time/fps';
import {clamp} from '../../core/time/ease';
import {G} from './theme';

export const INK_DUR = 36; // кадров на смену полосы
const GROW = Easing.bezier(0.45, 0.2, 0.35, 1); // пятно растекается быстро, к краям кадра — медленнее
const N = 1440; // точек края
const LINE = 2; // px — линия края: на столько контур под полосой шире её самой
const LINE_ALPHA = 0.55;

// Край в долях радиуса: лепестки (крупно, медленно меняются — разная скорость по направлениям), выпуклости, волна и мелкая
// неровность бумаги. Края скруглённые, как у жидкости: зубцы и шипы читаются как горелая или рваная бумага.
// DIP — насколько край может уйти внутрь круга: по нему считается радиус, при котором кадр закрыт
const LOBE = 0.1;
const BULGE = 0.05;
const WAVE = 0.02;
const RAG = 0.008;
const DIP = LOBE + BULGE + WAVE + RAG;

const COS = Array.from({length: N}, (_, i) => Math.cos((i / N) * Math.PI * 2));
const SIN = Array.from({length: N}, (_, i) => Math.sin((i / N) * Math.PI * 2));

// шум на окружности (cos, sin)·fq — замкнут без шва (fq = 1 — около пяти выпуклостей по кругу); z — медленное «дыхание» края
const ring = (seed: string, i: number, fq: number, z: number) => noise3D(seed, COS[i] * fq, SIN[i] * fq, z);

// Контур пятна радиуса base (+ add px) для clip-path. Точки — с шагом step: у маленького пятна их меньше — Chrome рисует
// clip-path из почти совпадающих точек лучами (проверено на кадрах), поэтому между точками не меньше ~5 px
const blot = (cx: number, cy: number, base: number, s: string, z: number, add = 0) => {
  const step = Math.max(1, Math.floor(N / Math.max(48, (2 * Math.PI * base) / 5)));
  let d = '';
  for (let i = 0; i < N; i += step) {
    const e = 1 + LOBE * ring(`${s}l`, i, 0.7, z) + BULGE * ring(`${s}u`, i, 1.8, z) + WAVE * ring(`${s}r`, i, 5, z) + RAG * ring(`${s}g`, i, 13, z);
    const r = Math.max(0, base * e + add);
    d += `${i ? 'L' : 'M'}${(cx + COS[i] * r).toFixed(1)} ${(cy + SIN[i] * r).toFixed(1)}`;
  }
  return `path('${d}Z')`;
};

// Новая полоса children проступает пятном с кадра at; x, y — точка, откуда растекается (доли кадра), seed — зерно края
export const InkBleed: React.FC<{at: number; x: number; y: number; seed: number; dur?: number; children: React.ReactNode}> = ({at, x, y, seed, dur = INK_DUR, children}) => {
  const f = useFrame();
  const {width, height} = useVideoConfig();
  const p = interpolate(f, [at, at + dur], [0, 1], clamp);
  const live = p > 0 && p < 1;
  let page: string | undefined = p <= 0 ? 'inset(50%)' : undefined;
  let line = '';
  if (live) {
    const cx = x * width;
    const cy = y * height;
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy));
    const base = ((far + LINE + 6) / (1 - DIP)) * GROW(p);
    const z = 0.3 + 0.8 * p;
    const s = `ink${seed}`;
    page = blot(cx, cy, base, s, z);
    line = blot(cx, cy, base, s, z, LINE);
  }
  // линия — тот же контур на 2 px шире, под полосой, чуть размыта (фильтр только пока идёт смена); ключи — слой полосы
  // не пересоздаётся, когда линия появляется и исчезает
  return (
    <AbsoluteFill>
      {live ? (
        <AbsoluteFill key="line" style={{filter: 'blur(0.6px)'}}>
          <AbsoluteFill style={{background: G.ink, opacity: LINE_ALPHA, clipPath: line}} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill key="page" style={{clipPath: page}}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
