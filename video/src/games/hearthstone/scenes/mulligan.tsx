// Муллиган — «Компендиум»: колонки «оставлять / по ситуации / менять» — подпись цветными чернилами, линия, карты под голос
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {HeaderBand, Page} from '../../../looks/compendium/parts';
import {SceneBody} from '../../../looks/compendium/motion';
import {DISPLAY, H, ramp} from '../../../looks/compendium/theme';
import {CardRow} from './parts';
import {Sfx} from '../../../core/audio/Sfx';
import {timeAt} from '../../../core/voice/timing';
import type {SegTiming} from '../../../core/video/types';
import type {MulliganSeg} from './types';
import {defineScene} from '../../../core/video/registry';
import {useFrame} from '../../../core/time/fps';

export const TONE = {keep: H.positive, maybe: H.even, toss: H.negative} as const;

export const MulliganScene: React.FC<{seg: MulliganSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useFrame();
  const at = timeAt(t, seg.vo, 16);
  const groups = seg.groups.map((g, i, all) => ({...g, at: at(g.at, i, all.length)}));
  const n = groups.length;
  const gap = 48;
  const colW = (1792 - gap * (n - 1)) / n;
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {groups.map((g, gi) => {
          const x = 64 + gi * (colW + gap);
          const p = ramp(f, g.at, g.at + 16);
          return (
            <React.Fragment key={g.label}>
              <div style={{position: 'absolute', left: x, top: 200, opacity: p, translate: `0 ${(1 - p) * 10}px`, fontFamily: DISPLAY, fontSize: 48, color: TONE[g.tone]}}>{g.label}</div>
              <div style={{position: 'absolute', left: x, top: 268, width: colW * p, height: 3, background: TONE[g.tone], opacity: 0.7}} />
              <CardRow cards={g.cards.map((id, ci) => ({id, at: g.at + 4 + ci * 5}))} x={x} w={colW} cy={580} h={500} />
            </React.Fragment>
          );
        })}
        {groups.map((g, i) => (
          <Sfx key={i} file="lib/sfx/card-draw.wav" at={g.at + 4} volume={0.2} />
        ))}
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title} />
    </AbsoluteFill>
  );
};

export const mulligan = defineScene<MulliganSeg>({kind: 'mulligan', Component: MulliganScene});
