// Финал — «Компендиум» и конечная заставка YouTube: слева прощание и ссылки, справа места под элементы
// конечной заставки (видео и подписка) в золотых рамках — их расставляют в YouTube Studio поверх
import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {DISPLAY, MANACOST} from '../../../brand';
import {HeaderBand, Page, Words} from '../parts';
import {goldFrame, H, ramp, TEXT} from '../theme';
import {OutroSeg, SegTiming} from '../types';

export const OutroScene: React.FC<{seg: OutroSeg; t: SegTiming}> = ({seg}) => {
  const f = useCurrentFrame();
  const fr = ramp(f, 26, 48);
  return (
    <AbsoluteFill>
      <Page />
      <HeaderBand kicker={MANACOST.site} title={MANACOST.name} crest={staticFile(MANACOST.logo)} crestRound={false} />
      <Words text={seg.title} at={10} stagger={3} dur={20} style={{position: 'absolute', left: 90, top: 236, fontFamily: DISPLAY, fontSize: 104, lineHeight: 1.04, color: H.ink}} />
      <div style={{position: 'absolute', left: 96, top: 510, width: 860}}>
        {seg.links.map((l, i) => {
          const p = ramp(f, 24 + i * 6, 42 + i * 6);
          return (
            <div key={l.text} style={{position: 'relative', display: 'flex', alignItems: 'baseline', gap: 22, padding: '20px 0', opacity: p, translate: `${(1 - p) * -16}px 0`}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: 860 * p, height: 1.5, background: `${H.ink}22`}} />
              <span style={{fontFamily: DISPLAY, fontSize: 40, color: H.red, width: 34}}>{i + 1}</span>
              <span style={{fontFamily: DISPLAY, fontSize: 44, color: H.ink}}>{l.text}</span>
              <span style={{fontFamily: TEXT, fontWeight: 500, fontSize: 26, color: H.inkMuted}}>{l.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 1090, top: 250, width: 740, height: 416, ...goldFrame(8), background: 'rgba(48,37,28,0.08)', opacity: fr}} />
      <div style={{position: 'absolute', left: 1090, top: 710, width: 200, height: 200, borderRadius: '50%', border: `4px solid ${H.gold}`, background: 'rgba(48,37,28,0.08)', opacity: fr}} />
    </AbsoluteFill>
  );
};
