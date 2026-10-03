// Тезисы (советы, план на игру) — «Компендиум»: раздел с крупными тезисами слева, справа карта, портрет или картинка
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {CardRow, HeaderBand, HeroPortrait, MainPoints, Mural, Page, SceneBody} from '../parts';
import {ramp, timber} from '../theme';
import {timeAt} from '../timing';
import {PointsSeg, SegTiming} from '../types';
import {useFrame} from '../fps';

const SideImage: React.FC<{src: string; dur: number; at: number}> = ({src, dur, at}) => {
  const f = useFrame();
  const p = ramp(f, at, at + 22);
  return (
    <div style={{position: 'absolute', left: 1150, top: 230, width: 700, height: 600, ...timber(16), overflow: 'hidden', opacity: p, translate: `0 ${(1 - p) * 40}px`, boxShadow: '0 24px 40px rgba(60,25,10,0.35)'}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', scale: interpolate(f, [0, dur], [1.02, 1.08])}} />
    </div>
  );
};

export const PointsScene: React.FC<{seg: PointsSeg; t: SegTiming}> = ({seg, t}) => {
  const at = timeAt(t, seg.vo, 16);
  const points = seg.points.map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  const side = seg.side;
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {seg.mural && <Mural src={seg.mural} x={1200} y={200} h={900} opacity={0.25} />}
        <MainPoints items={points} x={64} y={190} w={side ? 1000 : 1600} big label={seg.kicker ?? 'Главное'} />
        {side && 'card' in side && <CardRow cards={[{id: side.card, at: 14}]} x={1150} w={700} cy={540} h={680} />}
        {side && 'hero' in side && <HeroPortrait hero={side.hero} cx={1500} cy={540} w={480} h={580} at={14} />}
        {side && 'image' in side && <SideImage src={side.image} dur={t.dur} at={14} />}
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title} />
    </AbsoluteFill>
  );
};
