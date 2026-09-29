// Заставка места для топ-3: красное сукно во весь кадр, крупная золотая цифра выезжает из-под маски,
// затем сукно уходит вверх и открывает сцену колоды (её шапка — то же сукно, склейка читается как одно движение)
import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {DISPLAY} from '../../brand';
import {EASE_IN_OUT, H, ramp, redBg, TEXT} from '../theme';

export const REVEAL_HOLD = 44; // кадров до начала ухода сукна
const EXIT = 18;

export const RankReveal: React.FC<{rank: number; of?: number}> = ({rank, of}) => {
  const f = useCurrentFrame();
  const exit = interpolate(f, [REVEAL_HOLD, REVEAL_HOLD + EXIT], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IN_OUT});
  if (exit >= 1) return null;
  const n = ramp(f, 3, 20);
  const k = ramp(f, 8, 24);
  return (
    <div style={{position: 'absolute', inset: 0, translate: `0 ${-exit * 100}%`, ...redBg, boxShadow: '0 20px 40px rgba(40,5,8,0.45)'}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, background: `linear-gradient(${H.woodSoft}, ${H.wood})`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', opacity: k, fontFamily: TEXT, fontWeight: 800, fontSize: 30, letterSpacing: '0.34em', color: H.cream, textTransform: 'uppercase'}}>
        {rank === 1 ? 'Лидер меты' : 'Место'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, height: 470, overflow: 'hidden', display: 'flex', justifyContent: 'center'}}>
        <div style={{fontFamily: DISPLAY, fontSize: 440, lineHeight: 1.05, color: H.goldBright, textShadow: '0 10px 0 rgba(40,5,8,0.75)', translate: `0 ${(1 - n) * 100}%`}}>{rank}</div>
      </div>
      {of && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', opacity: k, fontFamily: TEXT, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: H.cream, textTransform: 'uppercase'}}>
          из {of}
        </div>
      )}
    </div>
  );
};
