// Стиль «Компендиум» для движка под голос (core/video/VoicedVideo.tsx): фон-пергамент, перелистывание страницы на стыке
// (motion.tsx), субтитры, тёплая виньетка и зерно плёнки, шелест страницы. Место в шапке предыдущей сцены
// (ctx.ranks) — чтобы номер следующей колоды прокручивался с него
import React from 'react';
import {FrameProps, VoicedLook} from '../../core/video/registry';
import {Grain} from '../../core/fx/Grain';
import {Page, Subtitles, Vignette} from './parts';
import {OVL, SceneMotion} from './motion';
import type {CompendiumCtx, RankCtx} from './types';

export type {CompendiumCtx, RankCtx};

const Frame: React.FC<FrameProps<RankCtx>> = ({i, dur, first, last, ctx, children}) => {
  const prevRank = ctx.ranks?.[i - 1];
  return (
    <SceneMotion dur={dur} first={first} last={last} prevRank={prevRank} prevRankOf={prevRank !== undefined ? ctx.rankOf : undefined}>
      {children}
    </SceneMotion>
  );
};

const Overlay: React.FC = () => (
  <>
    <Vignette />
    <Grain />
  </>
);

// Канал со стилем отдаёт в ctx всё, что нужно сценам стиля (CompendiumCtx: бренд, места, гербы, итоговая таблица);
// самому переходу нужны только места
export const compendium: VoicedLook<CompendiumCtx> = {
  Backdrop: Page,
  Frame,
  Subtitles,
  subtitles: {cx: 960, maxW: 1560, bottom: 26}, // нижняя полоса под контентом
  Overlay,
  overlap: OVL,
  cut: {file: 'lib/sfx/page-turn.wav', volume: 0.24, before: 2},
};
