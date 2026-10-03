// Финал — «Компендиум» и конечная заставка YouTube: слева прощание и ссылки, справа места под элементы
// конечной заставки (видео и подписка) в золотых рамках — их расставляют в YouTube Studio поверх.
// С recap финал открывается итоговой таблицей всех колод; на фразе recap.to страница перелистывается на заставку,
// шапка остаётся и меняет надписи
import React from 'react';
import {AbsoluteFill, interpolate, staticFile} from 'remotion';
import {DISPLAY, MANACOST} from '../../brand';
import {HeaderBand, OVL, Page, PageLayer, RecapBoard, Sfx, Words} from '../parts';
import {EASE_IN_OUT, goldFrame, H, ramp, TEXT} from '../theme';
import {recapTurn} from '../timing';
import {OutroSeg, RecapDeck, SegTiming} from '../types';
import {useFrame} from '../fps';

export const OutroScene: React.FC<{seg: OutroSeg; t: SegTiming; decks?: RecapDeck[]}> = ({seg, t, decks = []}) => {
  const f = useFrame();
  const recap = seg.recap && decks.length ? seg.recap : undefined;
  const sw = recap ? recapTurn(seg, t) : 0; // кадр перелистывания
  const turn = recap ? interpolate(f, [sw, sw + OVL], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IN_OUT}) : undefined;
  const fr = ramp(f, sw + 26, sw + 48);
  const brand = {kicker: MANACOST.site, title: MANACOST.name};
  return (
    <AbsoluteFill>
      {recap && (
        <PageLayer exit={turn}>
          <Page />
          <RecapBoard decks={decks} to={sw + OVL} />
        </PageLayer>
      )}
      <PageLayer enter={turn}>
        <Page />
        <Words text={seg.title} at={sw + 10} stagger={3} dur={20} style={{position: 'absolute', left: 90, top: 236, fontFamily: DISPLAY, fontSize: 104, lineHeight: 1.04, color: H.ink}} />
        <div style={{position: 'absolute', left: 96, top: 510, width: 860}}>
          {seg.links.map((l, i) => {
            const p = ramp(f, sw + 24 + i * 6, sw + 42 + i * 6);
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
      </PageLayer>
      <HeaderBand
        kicker={recap ? recap.kicker : brand.kicker}
        title={recap ? recap.title : brand.title}
        crest={staticFile(MANACOST.logo)}
        crestRound={false}
        next={recap ? {at: sw, ...brand} : undefined}
      />
      {recap && <Sfx file="lib/sfx/page-turn.wav" at={sw - 2} volume={0.24} />}
    </AbsoluteFill>
  );
};
