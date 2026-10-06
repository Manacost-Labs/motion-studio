// Тезисы (советы, план на игру) — «Компендиум»: раздел с крупными тезисами слева, справа картинка из public
// или сторона игры (у Hearthstone — карта или портрет героя: games/hearthstone/scenes/points.tsx). Сторону игры рисует
// Aside, который игра передаёт в pointsScene; без него сцена знает только картинку
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {HeaderBand, MainPoints, Mural, Page} from '../parts';
import {SceneBody} from '../motion';
import {ramp, timber} from '../theme';
import {timeAt} from '../../../core/voice/timing';
import type {SegTiming} from '../../../core/video/types';
import type {PointsSeg} from '../types';
import {defineScene} from '../../../core/video/registry';
import {useFrame} from '../../../core/time/fps';

const SideImage: React.FC<{src: string; dur: number; at: number}> = ({src, dur, at}) => {
  const f = useFrame();
  const p = ramp(f, at, at + 22);
  return (
    <div style={{position: 'absolute', left: 1150, top: 230, width: 700, height: 600, ...timber(16), overflow: 'hidden', opacity: p, translate: `0 ${(1 - p) * 40}px`, boxShadow: '0 24px 40px rgba(60,25,10,0.35)'}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', scale: interpolate(f, [0, dur], [1.02, 1.08])}} />
    </div>
  );
};

const isImage = (side: object): side is {image: string} => 'image' in side;

// Сторона игры справа (зона x 1150…1850, y 200…880)
export type PointsAside<Side> = React.FC<{side: Side}>;

export const PointsScene = <Side extends object = never>({seg, t, Aside}: {seg: PointsSeg<Side>; t: SegTiming; Aside?: PointsAside<Side>}) => {
  const at = timeAt(t, seg.vo, 16);
  const points = seg.points.map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  const side = seg.side;
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {seg.mural && <Mural src={seg.mural} x={1200} y={200} h={900} opacity={0.25} />}
        <MainPoints items={points} x={64} y={190} w={side ? 1000 : 1600} big label={seg.kicker ?? 'Главное'} />
        {side && (isImage(side) ? <SideImage src={side.image} dur={t.dur} at={14} /> : Aside && <Aside side={side} />)}
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title} />
    </AbsoluteFill>
  );
};

// Сцена тезисов со стороной игры: pointsScene<{card: string} | {hero: string}>(HsAside) — так тип сегмента канала
// принимает и стороны игры; points — без стороны игры (только картинка)
export const pointsScene = <Side extends object = never>(Aside?: PointsAside<Side>) =>
  defineScene<PointsSeg<Side>>({kind: 'points', Component: ({seg, t}) => <PointsScene seg={seg} t={t} Aside={Aside} />});
export const points = pointsScene();
