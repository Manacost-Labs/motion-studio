// Обложка ролика по Hearthstone в стиле «Компендиум» (композиции <id>-thumb регистрирует студия: Root.tsx → core/video/compositions.tsx)
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {DISPLAY, H, parchmentBg, redBg, TEXT} from '../../../looks/compendium/theme';
import {useFitSize} from '../../../core/layout/fit';
import {hsRender} from '../data/assets';

// Что на обложке: title — заголовок (перенос строки — \n), badge — надзаголовок, cards — 3 карты веером справа
// (последняя — передняя), hook — надпись на сургучной печати поверх веера
export type ThumbSpec = {title: string; badge: string; cards: string[]; hook?: string};

// Обложка 1280×720 «Компендиум»: слева красное сукно с заголовком, справа пергамент и три карты веером.
// Веер держится левее правого нижнего угла — там YouTube рисует плашку длительности. hook — сургучная печать.
// logo — картинка канала внизу слева (URL, staticFile), её даёт студия из бренда
export const Thumb: React.FC<{thumb: ThumbSpec; logo: string}> = ({thumb, logo}) => {
  const titleSize = useFitSize(thumb.title, {width: 600, max: 96, min: 56}); // слева от веера карт
  const H0 = 520; // высота карты
  const fan = [
    {x: 862, y: 138, r: -11},
    {x: 1072, y: 128, r: 8},
    {x: 968, y: 84, r: -1},
  ];
  return (
    <AbsoluteFill style={parchmentBg}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 700, height: 720, ...redBg}} />
      <div style={{position: 'absolute', left: 700, top: 0, width: 8, height: 720, background: `linear-gradient(90deg, ${H.woodSoft}, ${H.wood})`}} />
      {thumb.cards.slice(0, 3).map((id, i) => (
        <Img
          key={id}
          src={hsRender(id)}
          style={{position: 'absolute', left: fan[i].x - (H0 * 512) / 776 / 2, top: fan[i].y, height: H0, rotate: `${fan[i].r}deg`, filter: 'drop-shadow(0 22px 22px rgba(60,25,10,0.45))'}}
        />
      ))}
      {thumb.hook && (
        <div
          style={{
            position: 'absolute',
            left: 700 + 26,
            top: 452,
            width: 176,
            height: 176,
            borderRadius: '50%',
            rotate: '-8deg',
            background: 'radial-gradient(circle at 38% 32%, #b3262c, #7a1015 62%, #4d0a0e)',
            boxShadow: `0 0 0 6px ${H.gold}, 0 0 0 9px ${H.wood}, 0 16px 26px rgba(40,5,8,0.5)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: DISPLAY,
            fontSize: 66,
            color: H.goldBright,
            textShadow: '0 3px 0 rgba(40,5,8,0.8)',
          }}
        >
          {thumb.hook}
        </div>
      )}
      <div style={{position: 'absolute', left: 56, top: 64}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, fontFamily: TEXT, fontWeight: 800, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase', color: H.goldBright}}>
          <span style={{width: 12, height: 12, rotate: '45deg', background: H.goldBright}} />
          {thumb.badge}
        </div>
        <div style={{fontFamily: DISPLAY, fontSize: titleSize, lineHeight: 1.02, whiteSpace: 'pre', color: H.cream, textShadow: '0 4px 0 rgba(40,5,8,0.7)'}}>{thumb.title}</div>
      </div>
      <Img src={logo} style={{position: 'absolute', left: 56, bottom: 40, height: 130}} />
    </AbsoluteFill>
  );
};
