// Матч-апы — «Компендиум»: ведомость на пергаменте — герб класса, название и пояснение, итог цветными чернилами
// (или процент побед с полосой — только реальные цифры)
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {HeaderBand, Page} from '../../../looks/compendium/parts';
import {SceneBody} from '../../../looks/compendium/motion';
import {DISPLAY, H, ramp, TEXT} from '../../../looks/compendium/theme';
import {crestFor} from './parts';
import {timeAt} from '../../../core/voice/timing';
import type {SegTiming} from '../../../core/video/types';
import type {MatchupsSeg} from './types';
import {defineScene} from '../../../core/video/registry';
import {useFrame} from '../../../core/time/fps';

const VERDICT = {good: 'Выгодно', even: 'На равных', bad: 'Тяжело'} as const;
const COLOR = {good: H.positive, even: H.even, bad: H.negative} as const;

export const MatchupsScene: React.FC<{seg: MatchupsSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useFrame();
  const at = timeAt(t, seg.vo, 16);
  const rows = seg.rows.map((r, i, all) => ({...r, at: at(r.at, i, all.length)}));
  const W = 1300;
  const x = (1920 - W) / 2;
  const rowH = Math.min(118, 700 / rows.length);
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {rows.map((r, i) => {
          const p = ramp(f, r.at, r.at + 16);
          const fill = ramp(f, r.at + 6, r.at + 30);
          const y = 200 + i * rowH;
          return (
            <div key={r.name} style={{position: 'absolute', left: x, top: y, width: W, height: rowH, display: 'flex', alignItems: 'center', gap: 26}}>
              <div style={{position: 'absolute', left: 0, bottom: 0, width: W * p, height: 1.5, background: `${H.ink}22`}} />
              <Img src={crestFor(r.cls)} style={{width: rowH * 0.7, height: rowH * 0.7, opacity: p, scale: 0.85 + 0.15 * p, filter: 'drop-shadow(0 4px 6px rgba(60,25,10,0.35))'}} />
              <div style={{flex: 1, minWidth: 0, opacity: p, translate: `${(1 - p) * -16}px 0`}}>
                <div style={{fontFamily: DISPLAY, fontSize: rowH * 0.38, color: H.ink, whiteSpace: 'nowrap'}}>{r.name}</div>
                {r.note && <div style={{fontFamily: TEXT, fontWeight: 500, fontSize: rowH * 0.22, color: H.inkMuted}}>{r.note}</div>}
              </div>
              {r.value !== undefined ? (
                <div style={{display: 'flex', alignItems: 'center', gap: 20, opacity: p}}>
                  <div style={{width: 280, height: 10, borderRadius: 5, background: `${H.ink}18`}}>
                    <div style={{width: `${r.value * fill}%`, height: '100%', borderRadius: 5, background: COLOR[r.verdict]}} />
                  </div>
                  <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: rowH * 0.34, color: COLOR[r.verdict], width: 120, textAlign: 'right'}}>{(r.value * fill).toFixed(1)}%</span>
                </div>
              ) : (
                <div style={{fontFamily: TEXT, fontWeight: 800, fontSize: rowH * 0.24, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR[r.verdict], opacity: p}}>{VERDICT[r.verdict]}</div>
              )}
            </div>
          );
        })}
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title} />
    </AbsoluteFill>
  );
};

export const matchups = defineScene<MatchupsSeg>({kind: 'matchups', Component: MatchupsScene});
