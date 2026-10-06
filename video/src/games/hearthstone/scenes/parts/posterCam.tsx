// Постер колоды (api.blizzcore.ru) с «камерой»: когда диктор называет карту, камера наезжает на неё,
// карта приподнимается (+10%), светлеет и получает тёплый свет, остальная колода чуть притухает; затем карта
// опускается и камера отъезжает к общему плану — или сразу переезжает к следующей названной карте.
// Движение камеры — с настоящим размытием в движении (только пока камера едет).
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {cardRect} from '../../data/poster';
import {Focus, Key, MARGIN, PosterPlan} from '../../data/camera';
import type {DeckPosterData} from '../../data/types';
import {ramp} from '../../../../looks/compendium/theme';
import {hsRender} from '../../data/assets';
import {useFrame} from '../../../../core/time/fps';
import {InkCircle} from '../../../../looks/compendium/parts/ink';

// План камеры (planCamera) — данные игры, его считает и проверка yt-qa: ../../data/camera.ts

const LIFT = 16; // подъём/опускание карты
const EIO = Easing.bezier(0.65, 0, 0.35, 1);

const camAt = (keys: Key[], f: number): Focus => {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].f <= f) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  if (a === b || f <= a.f) return a;
  const t = interpolate(f, [a.f, b.f], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EIO});
  // зум в логарифмической шкале — наезд без ускорения к концу
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
  return {fx: a.fx + (b.fx - a.fx) * t, fy: a.fy + (b.fy - a.fy) * t, z};
};

const PosterView: React.FC<{p: DeckPosterData; plan: PosterPlan; w: number; h: number; dur: number}> = ({p, plan, w, h, dur}) => {
  const f = useFrame();
  const c = camAt(plan.keys, f);
  // общий план медленно «дышит» (едва заметный наезд), чтобы кадр не был мёртвым
  const breathe = interpolate(f, [0, dur], [1, 1.07]);
  const s = (w / p.w) * c.z * breathe;
  const iw = p.w * s;
  const ih = p.h * s;
  // страховка: с точками из planCamera(…, view) упор не срабатывает
  const ox = Math.min(MARGIN, Math.max(w - iw - MARGIN, w / 2 - c.fx * s));
  const oy = Math.min(MARGIN, Math.max(h - ih - MARGIN, h / 2 - c.fy * s));
  const lifts = plan.lifts.map((l) => ({...l, k: interpolate(f, [l.a, l.a + LIFT, l.b - LIFT, l.b], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EIO})}));
  const dim = Math.max(0, ...lifts.map((l) => l.k));
  const at = (r: {x: number; y: number; w: number; h: number}): React.CSSProperties => ({position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h});
  const px = 1 / s; // экранный пиксель в единицах постера — тени и подъём карты не зависят от зума
  // Постер и карты лежат в координатах постера, камера — один transform на весь слой. Раскладка через left/width
  // в экранных пикселях округляется Chrome до целых, у каждой карты в свой момент: при медленном ходе камеры
  // колода мелко дрожит (шаги −3, −4, −3 px вместо ровных −3,5). transform рисуется с субпиксельной точностью
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: p.w, height: p.h, transformOrigin: '0 0', transform: `translate(${ox}px, ${oy}px) scale(${s})`}}>
        <Img src={staticFile(p.src)} style={at({x: 0, y: 0, w: p.w, h: p.h})} />
        {/* поверх карт постера (≈236 px в ширину) — те же карты из рендеров HearthstoneJSON 512 px: на общем плане в 4K
            и при наезде камеры карта остаётся резкой, а не растянутой картинкой постера */}
        {p.order.map((id, idx) => (
          <Img key={idx} src={hsRender(id)} style={at(cardRect(p, idx))} />
        ))}
        <div style={{...at({x: 0, y: 0, w: p.w, h: p.h}), background: 'rgb(48,30,16)', opacity: 0.3 * dim}} />
        {lifts.map(({idx, k, a}) => {
          if (k <= 0.001) return null;
          return (
            <Img
              key={`${idx}-${a}`}
              src={hsRender(p.order[idx])}
              style={{
                ...at(cardRect(p, idx)),
                opacity: Math.min(1, k * 5),
                scale: 1 + 0.1 * k,
                translate: `0 ${-10 * k * px}px`,
                filter: `brightness(${1 + 0.12 * k}) drop-shadow(0 ${16 * k * px}px ${26 * k * px}px rgba(50,22,8,${0.5 * k})) drop-shadow(0 0 ${28 * k * px}px rgba(255,212,140,${0.55 * k}))`,
              }}
            />
          );
        })}
        {/* пометки пером поверх карт — в координатах постера, едут с камерой; гаснут, когда карта опускается и камера уходит */}
        {plan.lifts.map((l, i) => (l.ink ? <InkCircle key={`ink-${i}`} r={cardRect(p, l.idx)} at={l.a + 10} out={l.b} seed={l.idx + i} /> : null))}
      </div>
    </AbsoluteFill>
  );
};

export const DeckPoster: React.FC<{p: DeckPosterData; plan: PosterPlan; x: number; y: number; w: number; h: number; dur: number; at?: number}> = ({p, plan, x, y, w, h, dur, at = 8}) => {
  const f = useFrame();
  const e = ramp(f, at, at + 22);
  const moving = plan.moves.some(([a, b]) => f >= a - 1 && f <= b + 1);
  return (
    <div
      data-qa-clear="постер колоды"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden',
        opacity: e,
        translate: `0 ${(1 - e) * 30}px`,
        boxShadow: '0 18px 40px rgba(60,30,10,0.35)',
      }}
    >
      {/* размытие — наложением копий кадра (CameraMotionBlur): обычный DOM, без экспериментального HTML-in-canvas Chrome */}
      {moving ? (
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <PosterView p={p} plan={plan} w={w} h={h} dur={dur} />
        </CameraMotionBlur>
      ) : (
        <PosterView p={p} plan={plan} w={w} h={h} dur={dur} />
      )}
    </div>
  );
};
