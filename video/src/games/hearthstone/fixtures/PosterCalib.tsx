// Калибровка геометрии постера: рендеры всех карт поверх постера в режиме «разница».
// Совпадение — почти чёрное, сдвиг — светлый контур. Стенд на образце данных (композиции yt-poster-calib* регистрирует
// студия: studios/manacost-youtube/Root.tsx); геометрия — ../data/poster.ts, пересчёт — scripts/calib-poster.mjs
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {SAMPLE_ARTICLE as article} from './index';
import {cardRect} from '../data/poster';
import type {DeckPosterData} from '../data/types';

export const PosterCalib: React.FC<{rank: number}> = ({rank}) => {
  const d = article.decks.find((x) => x.rank === rank)!;
  const p = (d as unknown as {poster: DeckPosterData}).poster;
  const k = 1080 / p.h;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: p.w * k, height: p.h * k}}>
        <Img src={staticFile(p.src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
        {p.order.map((id, i) => {
          const r = cardRect(p, i);
          return (
            <Img
              key={`${id}-${i}`}
              src={staticFile(`hs/render/${id}.png`)}
              style={{position: 'absolute', left: r.x * k, top: r.y * k, width: r.w * k, height: r.h * k, mixBlendMode: 'difference'}}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
