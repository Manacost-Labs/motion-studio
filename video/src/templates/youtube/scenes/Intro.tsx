// Вступление — «Компендиум»: шапка из сукна с логотипом, крупный заголовок чернилами на пергаменте,
// строка гербов классов подборки (появляются по очереди) и полупрозрачный паладин справа
import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame} from 'remotion';
import {DISPLAY, MANACOST} from '../../../brand';
import {crestFor, HeaderBand, Mural, Page, Words} from '../parts';
import {H, ramp, TEXT} from '../theme';
import {staticFile} from 'remotion';
import {IntroSeg, SegTiming} from '../types';

export const IntroScene: React.FC<{seg: IntroSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useCurrentFrame();
  const classes = seg.classes ?? [];
  const kp = ramp(f, 16, 34);
  return (
    <AbsoluteFill>
      <Page />
      <Mural src={seg.mural ?? 'brand/arena/home-paladin-hero.webp'} x={1060} y={170} h={960} opacity={0.55} at={6} mask="linear-gradient(90deg, transparent 0%, #000 30%, #000 80%, transparent 100%)" />
      <HeaderBand kicker={MANACOST.site} title={MANACOST.name} crest={staticFile(MANACOST.logo)} crestRound={false} />
      <div style={{position: 'absolute', left: 96, top: 262, display: 'flex', alignItems: 'center', gap: 14, opacity: kp}}>
        <div style={{width: 11, height: 11, rotate: '45deg', background: H.red}} />
        <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 24, letterSpacing: '0.14em', color: H.inkMuted, textTransform: 'uppercase'}}>{seg.kicker}</span>
      </div>
      <Words text={seg.title} at={20} stagger={3} dur={20} style={{position: 'absolute', left: 90, top: 312, fontFamily: DISPLAY, fontSize: 150, lineHeight: 1.02, color: H.ink}} />
      {seg.sub && (
        <div style={{position: 'absolute', left: 96, top: 640, fontFamily: TEXT, fontWeight: 500, fontSize: 36, color: H.inkMuted, opacity: ramp(f, 40, 58), translate: `0 ${(1 - ramp(f, 40, 58)) * 12}px`}}>
          {seg.sub}
        </div>
      )}
      <div style={{position: 'absolute', left: 96, top: 730, display: 'flex', gap: 10, flexWrap: 'wrap', width: 900}}>
        {classes.map((c, i) => {
          const at = t.voFrom + (t.voDur * 0.55 * i) / Math.max(1, classes.length);
          const p = ramp(f, at, at + 14);
          return <Img key={i} src={crestFor(c)} style={{width: 72, height: 72, opacity: p, scale: 0.8 + 0.2 * p, filter: 'drop-shadow(0 4px 6px rgba(60,25,10,0.35))'}} />;
        })}
      </div>
    </AbsoluteFill>
  );
};
