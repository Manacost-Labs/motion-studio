// Ключевые карты / комбо — «Компендиум»: шапка из сукна, ряд крупных карт на пергаменте с подписями, под голос
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CardRow, HeaderBand, MainPoints, Mural, Page, SceneBody, Sfx} from '../parts';
import {timeAt} from '../timing';
import {CardsSeg, SegTiming} from '../types';

export const CardsScene: React.FC<{seg: CardsSeg; t: SegTiming}> = ({seg, t}) => {
  const at = timeAt(t, seg.vo, 16);
  const cards = seg.cards.map((c, i, all) => ({id: c.id, note: c.note, at: at(c.at, i, all.length)}));
  const points = (seg.points ?? []).map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  const side = points.length > 0;
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {seg.mural && <Mural src={seg.mural} x={1150} y={200} h={900} opacity={0.2} />}
        {side && <MainPoints items={points} x={64} y={190} w={620} />}
        <CardRow cards={cards} x={side ? 720 : 64} w={side ? 1136 : 1792} cy={540} h={600} />
        {cards.map((c, i) => (
          <Sfx key={`${c.id}-${i}`} file="lib/sfx/card-draw.wav" at={c.at} volume={0.2} />
        ))}
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title} />
    </AbsoluteFill>
  );
};
