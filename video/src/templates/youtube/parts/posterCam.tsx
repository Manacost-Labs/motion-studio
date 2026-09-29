// Постер колоды (api.blizzcore.ru) с «камерой»: когда диктор называет карту, камера наезжает на неё,
// карта приподнимается (+10%), светлеет и получает тёплый свет, остальная колода чуть притухает; затем карта
// опускается и камера отъезжает к общему плану — или сразу переезжает к следующей названной карте.
// Движение камеры — с настоящим размытием в движении (только пока камера едет).
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {MotionBlur} from './motionBlur';
import {cardRect} from '../poster';
import {DeckPosterData} from '../types';
import {ramp} from '../theme';
import {hsRender} from './stage';

const ZIN = 26; // кадров на наезд
const ZOUT = 30; // на отъезд
const HOLD = 100; // сколько держим карту, если следующая не звучит раньше
const LIFT = 16; // подъём/опускание карты
const ZOOM = 2.4;
const EIO = Easing.bezier(0.65, 0, 0.35, 1);

type Focus = {fx: number; fy: number; z: number};
type Key = Focus & {f: number};
export type PosterPlan = {keys: Key[]; lifts: {idx: number; a: number; b: number}[]; moves: [number, number][]};

// План камеры по моментам, когда звучат карты (at). Карты, которых нет на постере, пропускаются
export const planCamera = (p: DeckPosterData, cards: {id: string; at: number}[], dur: number): PosterPlan => {
  const OV: Focus = {fx: p.w / 2, fy: p.h / 2, z: 1};
  const inDeck = cards.map((c) => ({...c, idx: p.order.indexOf(c.id)})).filter((c) => c.idx >= 0);
  const keys: Key[] = [{f: 0, ...OV}];
  const lifts: PosterPlan['lifts'] = [];
  const moves: [number, number][] = [];
  let cur = OV;
  let t = 0;
  inDeck.forEach((c, i) => {
    const r = cardRect(p, c.idx);
    const target: Focus = {fx: r.cx, fy: r.cy, z: ZOOM};
    const s = Math.max(t + 1, c.at - 12);
    if (s + ZIN > dur - 10) return;
    keys.push({f: s, ...cur}, {f: s + ZIN, ...target});
    moves.push([s, s + ZIN]);
    const arrive = s + ZIN;
    const next = inDeck[i + 1];
    const nextStart = next ? next.at - 12 : Infinity;
    let end = Math.min(arrive + HOLD, nextStart, dur - 10 - ZOUT);
    end = Math.max(end, arrive + 24);
    lifts.push({idx: c.idx, a: arrive - 12, b: end});
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
  return {keys, lifts, moves};
};

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
  const f = useCurrentFrame();
  const c = camAt(plan.keys, f);
  // общий план медленно «дышит» (едва заметный наезд), чтобы кадр не был мёртвым
  const breathe = interpolate(f, [0, dur], [1, 1.035]);
  const s = (w / p.w) * c.z * breathe;
  const iw = p.w * s;
  const ih = p.h * s;
  const M = 120; // камера может чуть заходить за край постера — крайняя карта не прижимается к рамке
  const ox = Math.min(M, Math.max(w - iw - M, w / 2 - c.fx * s));
  const oy = Math.min(M, Math.max(h - ih - M, h / 2 - c.fy * s));
  const lifts = plan.lifts.map((l) => ({...l, k: interpolate(f, [l.a, l.a + LIFT, l.b - LIFT, l.b], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EIO})}));
  const dim = Math.max(0, ...lifts.map((l) => l.k));
  return (
    <AbsoluteFill>
      <Img src={staticFile(p.src)} style={{position: 'absolute', left: ox, top: oy, width: iw, height: ih}} />
      {/* поверх карт постера (≈236 px в ширину) — те же карты из рендеров HearthstoneJSON 512 px: на общем плане в 4K
          и при наезде камеры карта остаётся резкой, а не растянутой картинкой постера */}
      {p.order.map((id, idx) => {
        const r = cardRect(p, idx);
        return <Img key={idx} src={hsRender(id)} style={{position: 'absolute', left: ox + r.x * s, top: oy + r.y * s, width: r.w * s, height: r.h * s}} />;
      })}
      <div style={{position: 'absolute', left: ox, top: oy, width: iw, height: ih, background: 'rgb(48,30,16)', opacity: 0.3 * dim}} />
      {lifts.map(({idx, k, a}) => {
        if (k <= 0.001) return null;
        const r = cardRect(p, idx);
        return (
          <Img
            key={`${idx}-${a}`}
            src={hsRender(p.order[idx])}
            style={{
              position: 'absolute',
              left: ox + r.x * s,
              top: oy + r.y * s,
              width: r.w * s,
              height: r.h * s,
              opacity: Math.min(1, k * 5),
              scale: 1 + 0.1 * k,
              translate: `0 ${-10 * k}px`,
              filter: `brightness(${1 + 0.12 * k}) drop-shadow(0 ${16 * k}px ${26 * k}px rgba(50,22,8,${0.5 * k})) drop-shadow(0 0 ${28 * k}px rgba(255,212,140,${0.55 * k}))`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const DeckPoster: React.FC<{p: DeckPosterData; plan: PosterPlan; x: number; y: number; w: number; h: number; dur: number; at?: number}> = ({p, plan, x, y, w, h, dur, at = 8}) => {
  const f = useCurrentFrame();
  const e = ramp(f, at, at + 22);
  const moving = plan.moves.some(([a, b]) => f >= a - 1 && f <= b + 1);
  return (
    <div
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
      {/* размытие рисуется с плотностью пикселей рендера — в 4K колода в движении не мягче, чем в покое */}
      {moving ? (
        <MotionBlur width={w} height={h} samples={8} shutterAngle={180}>
          <PosterView p={p} plan={plan} w={w} h={h} dur={dur} />
        </MotionBlur>
      ) : (
        <PosterView p={p} plan={plan} w={w} h={h} dur={dur} />
      )}
    </div>
  );
};
