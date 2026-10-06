// Стиль «Газета» для движка ролика под голос (core/video/registry.ts → VoicedLook): бумага, смена полос, субтитры наборным
// шрифтом под линейкой. Переход — новая полоса ложится поверх: выезжает снизу с тенью, прежняя чуть темнеет (без поворотов и тряски)
import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {useFrame} from '../../core/time/fps';
import {clamp, EASE_IN_OUT, ramp} from '../../core/time/ease';
import type {FrameProps, VoicedLook} from '../../core/video/registry';
import type {Sub} from '../../core/voice/timing';
import {G, TEXT} from './theme';

const OVERLAP = 18;

const Backdrop: React.FC = () => <AbsoluteFill style={{background: G.paper}} />;

const Frame: React.FC<FrameProps> = ({dur, first, last, children}) => {
  const f = useFrame();
  const enter = first ? 1 : ramp(f, 0, OVERLAP, EASE_IN_OUT);
  const leave = last ? 0 : interpolate(f, [dur - OVERLAP, dur], [0, 1], {...clamp, easing: EASE_IN_OUT});
  return (
    <AbsoluteFill style={{transform: `translateY(${(1 - enter) * 100}%)`, boxShadow: enter < 1 ? '0 -24px 48px rgba(0,0,0,0.18)' : undefined, background: G.paper}}>
      {children}
      {leave > 0 ? <AbsoluteFill style={{background: '#000', opacity: leave * 0.12}} /> : null}
    </AbsoluteFill>
  );
};

const Subtitles: React.FC<{subs: Sub[]; cx: number; bottom: number; maxW: number}> = ({subs, cx, bottom, maxW}) => {
  const f = useFrame();
  const cue = subs.find((s) => f >= s.from && f < s.to);
  if (!cue) return null;
  const o = Math.min(ramp(f, cue.from, cue.from + 4), 1 - ramp(f, cue.to - 4, cue.to));
  return (
    <div style={{position: 'absolute', left: cx - maxW / 2, width: maxW, bottom, textAlign: 'center', opacity: o}}>
      <span style={{display: 'inline-block', background: G.paper, borderTop: `2px solid ${G.ink}`, padding: '8px 22px 10px', fontFamily: TEXT, fontSize: 32, lineHeight: 1.3, color: G.ink, whiteSpace: 'pre-line'}}>
        {cue.text}
      </span>
    </div>
  );
};

export const gazette: VoicedLook = {
  Backdrop,
  Frame,
  Subtitles,
  subtitles: {cx: 960, maxW: 1560, bottom: 96},
  overlap: OVERLAP,
  cut: {file: 'lib/sfx/page-turn.wav', volume: 0.2, before: 4},
};
