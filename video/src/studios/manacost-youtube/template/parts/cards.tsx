// Карты на пергаменте: въезжают снизу с торможением и размытием в движении, тёплая мягкая тень, дальше стоят.
// Ряд карт с подписями (ключевые карты, муллиган), портрет героя в деревянной раме
import React from 'react';
import {Img, staticFile} from 'remotion';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {DISPLAY} from '../../brand';
import {H, ramp, TEXT, timber} from '../theme';
import {hsArt, hsRender} from './stage';
import {useFrame} from '../fps';

const RATIO = 512 / 776;
const ENTER = 18;

const Blur: React.FC<{active: boolean; x: number; y: number; w: number; h: number; children: React.ReactNode}> = ({active, x, y, w, h, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
    {active ? (
      <CameraMotionBlur samples={8} shutterAngle={180}>
        {children}
      </CameraMotionBlur>
    ) : (
      children
    )}
  </div>
);

const Card: React.FC<{id: string; at: number; cx: number; cy: number; h: number}> = ({id, at, cx, cy, h}) => {
  const f = useFrame();
  if (f < at - 1) return null;
  const p = ramp(f, at, at + ENTER);
  const w = h * RATIO;
  return (
    <Img
      src={hsRender(id)}
      style={{
        position: 'absolute',
        left: cx - w / 2,
        top: cy - h / 2 + (1 - p) * 110,
        width: w,
        height: h,
        opacity: Math.min(1, p * 1.6),
        scale: 0.96 + 0.04 * p,
        filter: 'drop-shadow(0 24px 24px rgba(60,25,10,0.42))',
      }}
    />
  );
};

const moving = (f: number, frames: number[]) => frames.some((a) => f >= a - 1 && f <= a + ENTER + 1);

// Ряд карт с подписями «1 · текст» — карты появляются под голос
export const CardRow: React.FC<{cards: {id: string; at: number; note?: string}[]; x: number; w: number; cy: number; h: number}> = ({cards, x, w, cy, h}) => {
  const f = useFrame();
  const n = cards.length;
  const gap = 56;
  const hh = Math.min(h, (w - gap * (n - 1)) / n / RATIO);
  const cw = hh * RATIO;
  const start = x + (w - (n * cw + (n - 1) * gap)) / 2;
  const box = {x, y: cy - hh / 2 - 40, w, h: hh + 180};
  return (
    <>
      <Blur active={moving(f, cards.map((c) => c.at))} {...box}>
        {cards.map((c, i) => (
          <Card key={`${c.id}-${i}`} id={c.id} at={c.at} cx={start + i * (cw + gap) + cw / 2 - box.x} cy={cy - box.y} h={hh} />
        ))}
      </Blur>
      {cards.map((c, i) => {
        const p = ramp(f, c.at + 8, c.at + 24);
        return c.note ? (
          <div
            key={`n-${i}`}
            style={{
              position: 'absolute',
              left: start + i * (cw + gap) - 30,
              width: cw + 60,
              top: cy + hh / 2 + 18,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 12,
              opacity: p,
              translate: `0 ${(1 - p) * 12}px`,
              textAlign: 'center',
            }}
          >
            <span style={{fontFamily: DISPLAY, fontSize: 34, color: H.red}}>{i + 1}</span>
            <span style={{fontFamily: TEXT, fontWeight: 600, fontSize: 27, lineHeight: 1.25, color: H.ink}}>{c.note}</span>
          </div>
        ) : null;
      })}
    </>
  );
};

// Портрет героя в деревянной раме
export const HeroPortrait: React.FC<{hero: string; cx: number; cy: number; w: number; h: number; at: number}> = ({hero, cx, cy, w, h, at}) => {
  const f = useFrame();
  const p = ramp(f, at, at + 22);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - w / 2,
        top: cy - h / 2 + (1 - p) * 50,
        width: w,
        height: h,
        opacity: p,
        ...timber(16),
        boxShadow: '0 24px 40px rgba(60,25,10,0.35)',
        overflow: 'hidden',
      }}
    >
      <Img src={staticFile(hsArt(hero))} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </div>
  );
};
