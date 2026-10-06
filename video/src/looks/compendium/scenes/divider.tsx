// Разделитель блоков — без голоса, ~2,5 с, музыка в это время не приглушена: красное сукно, «Дальше» и крупное
// «Топ-10» выезжают из-под маски (удар барабана), под ними ряд медалей мест блока — первая, со следующим местом, золотая.
// Кадр медленно наезжает. Следующая колода перелистывается поверх, сукно остаётся её шапкой
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SceneBody} from '../motion';
import {DISPLAY, H, ramp, redBg, TEXT} from '../theme';
import type {SegTiming} from '../../../core/video/types';
import type {DividerSeg} from '../types';
import {Sfx} from '../../../core/audio/Sfx';
import {useFrame} from '../../../core/time/fps';
import {defineScene} from '../../../core/video/registry';

export const DividerScene: React.FC<{seg: DividerSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useFrame();
  const n = ramp(f, 4, 20);
  const k = ramp(f, 8, 22);
  const [a, b] = seg.block;
  const ranks = Array.from({length: Math.abs(a - b) + 1}, (_, i) => (a > b ? a - i : a + i));
  return (
    <SceneBody>
      <AbsoluteFill style={redBg} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, background: `linear-gradient(${H.woodSoft}, ${H.wood})`}} />
      <AbsoluteFill style={{scale: 1 + 0.03 * (f / t.dur)}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 236, textAlign: 'center', opacity: k, fontFamily: TEXT, fontWeight: 800, fontSize: 30, letterSpacing: '0.34em', color: H.cream, textTransform: 'uppercase'}}>
          {seg.kicker ?? 'Дальше'}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 286, height: 330, overflow: 'hidden', display: 'flex', justifyContent: 'center'}}>
          <div style={{fontFamily: DISPLAY, fontSize: 270, lineHeight: 1.12, color: H.goldBright, textShadow: '0 10px 0 rgba(40,5,8,0.75)', translate: `0 ${(1 - n) * 100}%`}}>{seg.title}</div>
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', gap: 30}}>
          {ranks.map((r, i) => {
            const p = ramp(f, 16 + i * 3, 30 + i * 3);
            const next = i === 0;
            return (
              <div
                key={r}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  boxSizing: 'border-box',
                  border: `4px solid ${H.gold}`,
                  background: next ? H.goldBright : 'rgba(40,5,8,0.25)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: DISPLAY,
                  fontSize: 46,
                  color: next ? H.redDark : H.cream,
                  opacity: p,
                  translate: `0 ${(1 - p) * 18}px`,
                  boxShadow: '0 6px 12px rgba(30,4,6,0.4)',
                }}
              >
                {r}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <Sfx file="lib/sfx/drum-hit.wav" at={6} volume={0.4} />
    </SceneBody>
  );
};

export const DIVIDER = 78; // длина разделителя блоков (без голоса)
// Без голоса и субтитров (silent); своей главы нет — входит в следующую; в карте темпа — «новинка»
export const divider = defineScene<DividerSeg>({
  kind: 'divider',
  Component: DividerScene,
  min: DIVIDER,
  chapter: false,
  silent: true,
  pace: (seg, t) => [{at: t.from, what: `разделитель «${seg.title}»`, news: true}],
});
