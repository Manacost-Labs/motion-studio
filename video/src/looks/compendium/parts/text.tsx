// Типографика: слова выезжают из-под маски; субтитры в плашке из красного сукна
import React from 'react';
import {interpolate} from 'remotion';
import {EASE_IN, H, ramp, TEXT} from '../theme';
import type {Sub} from '../../../core/voice/timing';
import {useFrame} from '../../../core/time/fps';

// Слова выезжают снизу из-под маски по очереди; out — кадр, с которого уходят вверх
// mark — черта чернилами под словами (0…1): тянется слева направо по словам и при переносе идёт по каждой строке текста
export const Words: React.FC<{text: string; at: number; stagger?: number; dur?: number; out?: number; style?: React.CSSProperties; mark?: number; markColor?: string}> = ({
  text,
  at,
  stagger = 2,
  dur = 16,
  out,
  style,
  mark,
  markColor = 'currentColor',
}) => {
  const f = useFrame();
  const n = text.split(/\s+/).filter(Boolean).length;
  let i = 0;
  return (
    <div style={style}>
      {text.split('\n').map((line, li) => (
        <div key={li}>
          {line.split(' ').map((w, wi, ws) => {
            const k = i++;
            const p = ramp(f, at + k * stagger, at + k * stagger + dur);
            const e = out === undefined ? 0 : ramp(f, out + k, out + k + 10, EASE_IN);
            // промежуток до следующего слова — отступ внутри слова (не margin), чтобы черта шла и под пробелом
            const gap = wi < ws.length - 1 && mark !== undefined;
            const fill = mark === undefined ? 0 : Math.min(1, Math.max(0, mark * n - k));
            const ink = fill > 0 ? {background: `linear-gradient(${markColor}, ${markColor}) no-repeat 0 100% / ${fill * 100}% 3px`} : undefined;
            return (
              <span key={wi} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: `0.08em ${gap ? '0.24em' : 0} 0.18em 0`, margin: `-0.08em ${gap ? 0 : '0.24em'} -0.18em 0`, ...ink}}>
                <span style={{display: 'inline-block', translate: `0 ${(1 - p) * 110 - e * 110}%`}}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Субтитры: кремовый текст в плашке из тёмно-красного сукна с золотой нитью (как lightbox на сайте)
export const Subtitles: React.FC<{subs: Sub[]; cx: number; bottom: number; maxW: number}> = ({subs, cx, bottom, maxW}) => {
  const f = useFrame();
  const cue = subs.find((s) => f >= s.from && f < s.to);
  if (!cue) return null;
  const o = Math.min(interpolate(f, [cue.from, cue.from + 4], [0, 1], {extrapolateRight: 'clamp'}), interpolate(f, [cue.to - 4, cue.to], [1, 0], {extrapolateLeft: 'clamp'}));
  return (
    <div style={{position: 'absolute', left: cx - maxW / 2, width: maxW, bottom, display: 'flex', justifyContent: 'center', opacity: o}}>
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(104,24,29,.96), rgba(48,12,17,.97))',
          border: `1px solid ${H.gold}88`,
          borderRadius: 8,
          padding: '10px 26px 12px',
          fontFamily: TEXT,
          fontWeight: 600,
          fontSize: 32,
          lineHeight: 1.32,
          color: '#f7e3b7',
          textAlign: 'center',
          textWrap: 'balance',
          whiteSpace: 'pre-line', // кусок уже разбит на две ровные строки (core/voice/timing.ts → twoLines)
          boxShadow: '0 10px 24px rgba(30,8,8,0.3)',
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
