// Реестр сцен YouTube-шаблона: вид сегмента (kind) → компонент. Новая сцена = файл здесь + строка в Scene + тип в types.ts
import React from 'react';
import {SegTiming, YtSegment} from '../types';
import {CardsScene} from './Cards';
import {DeckScene} from './Deck';
import {ImageScene} from './Image';
import {IntroScene} from './Intro';
import {MatchupsScene} from './Matchups';
import {MulliganScene} from './Mulligan';
import {OutroScene} from './Outro';
import {PointsScene} from './Points';

export const Scene: React.FC<{seg: YtSegment; t: SegTiming; rankOf?: number}> = ({seg, t, rankOf}) => {
  switch (seg.kind) {
    case 'intro':
      return <IntroScene seg={seg} t={t} />;
    case 'deck':
      return <DeckScene seg={seg} t={t} rankOf={rankOf} />;
    case 'cards':
      return <CardsScene seg={seg} t={t} />;
    case 'mulligan':
      return <MulliganScene seg={seg} t={t} />;
    case 'matchups':
      return <MatchupsScene seg={seg} t={t} />;
    case 'points':
      return <PointsScene seg={seg} t={t} />;
    case 'image':
      return <ImageScene seg={seg} t={t} />;
    case 'outro':
      return <OutroScene seg={seg} t={t} />;
  }
};

// Где стоят субтитры: нижняя полоса под контентом; в финале — слева, не на рамках конечной заставки
export const subtitleZone = (seg: YtSegment) => (seg.kind === 'outro' ? {cx: 540, maxW: 920} : {cx: 960, maxW: 1560});

// Название главы для описания YouTube
export const chapterOf = (seg: YtSegment) =>
  seg.chapter ??
  (seg.kind === 'intro' ? 'Вступление' : seg.kind === 'outro' ? 'Итоги и ссылки' : seg.kind === 'deck' ? (seg.rank !== undefined ? `${seg.rank}. ${seg.name}` : seg.name) : seg.title ?? seg.kind);
