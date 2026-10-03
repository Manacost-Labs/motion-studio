// Студия YouTube-роликов Манакоста (hs-manacost.ru): npm run studio:youtube. Свой бренд — ./brand, шаблон — ./template
// (описание — template/README.md). От бренда HearthPulse не зависит. Реестр — ../README.md
import React from 'react';
import {Composition, Folder, Still} from 'remotion';
import {PosterCalib} from './template/PosterCalib';
import {YtCompositions} from './template/YtVideo';
import {TEMPLATE_DEMO} from './template/demo';
import {LEGEND_DECKS_SEP26} from './yt-legend-decks-sep26/config';
import {YT_MOTION_SHOWCASE_DURATION, YtMotionShowcase} from './motion-showcase/Showcase';
import {DEPTH_LAB_DURATION, DepthLab} from './motion-showcase/DepthLab';

export const Root: React.FC = () => (
  <>
    {/* «15 колод для Легенды в сентябре» по статье hs-manacost.ru — черновик, не закреплён */}
    <Folder name="yt-legend-decks-sep26">
      <YtCompositions config={LEGEND_DECKS_SEP26} />
    </Folder>

    {/* Калибровка геометрии постеров колод (см. template/README.md) */}
    <Folder name="yt-poster-calib">
      <Still id="yt-poster-calib-8" component={() => <PosterCalib rank={15} />} width={1920} height={1080} />
      <Still id="yt-poster-calib-6" component={() => <PosterCalib rank={14} />} width={1920} height={1080} />
      {/* любая колода: --props='{"rank":3}' */}
      <Still id="yt-poster-calib" component={PosterCalib} defaultProps={{rank: 15}} width={1920} height={1080} />
    </Folder>

    {/* Демо шаблона: все виды сцен на примере гайда (не для публикации) */}
    <Folder name="yt-template-demo">
      <YtCompositions config={TEMPLATE_DEMO} />
    </Folder>

    {/* Витрина анимаций шаблона: каждый приём движения отдельно, с подписью (не для публикации) */}
    <Folder name="motion-showcase">
      <Composition id="yt-motion-showcase" component={YtMotionShowcase} durationInFrames={YT_MOTION_SHOWCASE_DURATION} fps={30} width={1920} height={1080} />
      {/* «живой» арт: параллакс по карте глубины (template/parts/depth.tsx), рендер с --gl=angle */}
      <Composition id="yt-depth-lab" component={DepthLab} defaultProps={{src: 'art/nathria.jpg'}} durationInFrames={DEPTH_LAB_DURATION} fps={60} width={1920} height={1080} />
    </Folder>
  </>
);
