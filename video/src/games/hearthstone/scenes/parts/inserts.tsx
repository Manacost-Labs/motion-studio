// Врезки на месте постера колоды (DeckSeg.inserts): разбор комбо и фрагмент геймплея.
// Постер на это время растворяется, врезка — в той же деревянной раме и на том же месте, левая колонка не двигается
import React from 'react';
import {Img, interpolate, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';
import {DISPLAY, H, ramp, TEXT, timber} from '../../../../looks/compendium/theme';
import type {ClipInsert, ComboInsert} from '../../data/types';
import {useFrame, useK} from '../../../../core/time/fps';
import {hsRender} from '../../data/assets';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const INSERT_IN = 14; // кадров на появление врезки и растворение постера
export const INSERT_OUT = 14;

// Насколько видна врезка [a, b] на кадре f (0…1) — ею же гасится постер
export const insertVis = (f: number, a: number, b: number) => interpolate(f, [a, a + INSERT_IN, b - INSERT_OUT, b], [0, 1, 1, 0], clamp);

const Label: React.FC<{text: string; p: number}> = ({text, p}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: p}}>
    <div style={{width: 10, height: 10, rotate: '45deg', background: H.red}} />
    <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 19, letterSpacing: '0.16em', color: H.inkMuted, textTransform: 'uppercase'}}>{text}</span>
    <div style={{flex: 1, height: 2, background: `linear-gradient(90deg, ${H.ink}55, transparent)`, scale: `${p} 1`, transformOrigin: 'left'}} />
  </div>
);

// Комбо: все карты сразу видны блёклыми и загораются на своих фразах (между ними «+»), под ними итоговые числа со счётчиком.
// Карты и числа — единым блоком по центру рамки
export const ComboPanel: React.FC<{ins: ComboInsert; times: {cards: number[]; results: number[]}; a: number; b: number; w: number; h: number}> = ({ins, times, a, b, w, h}) => {
  const f = useFrame();
  const vis = insertVis(f, a, b);
  if (vis <= 0.001) return null;
  const n = ins.cards.length;
  const ch = Math.min(h * 0.54, ((w - 110) / n - 34) / (512 / 776));
  const cw = ch * (512 / 776);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: vis, ...timber(14), background: H.parchmentLight, padding: '34px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34}}>
      <div style={{position: 'absolute', left: 40, right: 40, top: 34}}>
        <Label text={ins.title ?? 'Комбо'} p={ramp(f, a, a + 16)} />
      </div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, height: ch + 20}}>
        {ins.cards.map((c, i) => {
          const t = times.cards[i];
          const p = ramp(f, t - 4, t + 14);
          return (
            <React.Fragment key={i}>
              {i > 0 && <span style={{fontFamily: DISPLAY, fontSize: 64, color: H.red, opacity: 0.25 + 0.75 * p}}>+</span>}
              <Img
                src={hsRender(c.id)}
                style={{
                  height: ch,
                  width: cw,
                  opacity: 0.3 + 0.7 * p,
                  scale: 0.94 + 0.06 * p,
                  filter: `grayscale(${1 - p}) drop-shadow(0 ${14 * p}px ${18 * p}px rgba(60,25,10,${0.4 * p}))`,
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
      <div style={{display: 'flex', gap: 36, justifyContent: 'center', minHeight: 170}}>
        {ins.results.map((r, i) => {
          const t = times.results[i];
          const p = ramp(f, t - 2, t + 16);
          const next = times.results[i + 1];
          const dimmed = next !== undefined ? 1 - 0.45 * ramp(f, next, next + 12) : 1;
          const shown = Math.round(r.value * ramp(f, t, t + 16));
          return (
            <div key={i} style={{opacity: p * dimmed, translate: `0 ${(1 - p) * 14}px`, textAlign: 'center', minWidth: 220}}>
              <div style={{fontFamily: DISPLAY, fontSize: 112, lineHeight: 1, color: H.red, textShadow: '0 3px 0 rgba(40,5,8,0.15)'}}>{shown}</div>
              <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 24, lineHeight: 1.25, color: H.inkMuted, marginTop: 8, maxWidth: 320}}>{r.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Геймплей: видео в той же раме, кадрировано по crop; снизу подпись и автор (лицензия требует указывать)
export const ClipPanel: React.FC<{ins: ClipInsert; a: number; b: number; w: number; h: number}> = ({ins, a, b, w, h}) => {
  const f = useFrame();
  const K = useK();
  const {fps} = useVideoConfig();
  const vis = insertVis(f, a, b);
  if (vis <= 0.001) return null;
  const [cx, cy, cw, chh] = ins.crop ?? [0, 0, 1920, 1080];
  const k = Math.max(w / cw, h / chh);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: vis, ...timber(14), background: '#000', overflow: 'hidden'}}>
      <Sequence from={Math.round(a * K)} durationInFrames={Math.round((b - a) * K)} layout="none">
        <div style={{position: 'absolute', left: (w - cw * k) / 2 - cx * k, top: (h - chh * k) / 2 - cy * k, width: 1920 * k, height: 1080 * k, scale: 1 + 0.03 * ramp(f, a, b)}}>
          <OffthreadVideo src={staticFile(ins.src)} trimBefore={Math.round(ins.start * fps)} volume={ins.volume ?? 0} style={{width: '100%', height: '100%'}} />
        </div>
      </Sequence>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, padding: '60px 26px 18px', background: 'linear-gradient(transparent, rgba(30,14,6,0.82))'}}>
        {ins.caption && <div style={{fontFamily: TEXT, fontWeight: 700, fontSize: 26, color: H.cream}}>{ins.caption}</div>}
        <div style={{fontFamily: TEXT, fontWeight: 500, fontSize: 18, color: `${H.cream}cc`, marginTop: 6}}>{ins.credit}</div>
      </div>
    </div>
  );
};
