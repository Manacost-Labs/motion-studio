// Студия YouTube-роликов Манакоста (hs-manacost.ru): npm run studio:youtube. Канал (стиль, бренд, игра, сцены) — ./channel.ts,
// ролики — ./videos.ts, паспорт студии — ./README.md. От бренда HearthPulse не зависит. Реестр студий — ../README.md
import React from 'react';
import {Composition, Folder, staticFile, Still} from 'remotion';
import {voicedCompositions} from '../../core/video/compositions';
import {MANACOST, YT_BASE} from '../../brands/manacost/channel';
import {BASE_FPS} from '../../core/time/fps';
import {Thumb} from '../../games/hearthstone/scenes/thumb';
import {PosterCalib} from '../../games/hearthstone/fixtures/PosterCalib';
import {channel, type YtConfig} from './channel';
import {VIDEOS} from './videos';
import {TEMPLATE_DEMO} from './motion-showcase/demo';
import {YT_MOTION_SHOWCASE_DURATION, YtMotionShowcase} from './motion-showcase/Showcase';
import {DEPTH_LAB_DURATION, DepthLab} from './motion-showcase/DepthLab';
import {DEAL_LAB_SEC, DealLab} from './motion-showcase/DealLab';

// Частота проб движения — как у роликов канала; в черновике (render.ps1 -Draft) — 30 к/с, как у черновика ролика
const LAB_FPS = process.env.REMOTION_DRAFT ? BASE_FPS : YT_BASE.fps;

// Обложка 1280×720 — games/hearthstone/scenes/thumb.tsx, логотип — из бренда канала
const YtThumb: React.FC<{config: YtConfig}> = ({config}) => <Thumb thumb={config.thumb} logo={staticFile(MANACOST.logo)} />;
// Композиция ролика <id> (16:9, под голос) и обложки <id>-thumb, -thumb-b, -thumb-c (core/video/compositions.tsx)
const YtCompositions = voicedCompositions<YtConfig>(channel, YtThumb);

export const Root: React.FC = () => (
  <>
    {/* Ролики канала — ./videos.ts */}
    {VIDEOS.map((config) => (
      <Folder key={config.id} name={config.id}>
        <YtCompositions config={config} />
      </Folder>
    ))}

    {/* Калибровка геометрии постеров колод (games/hearthstone/fixtures/PosterCalib.tsx) */}
    <Folder name="yt-poster-calib">
      <Still id="yt-poster-calib-8" component={() => <PosterCalib rank={15} />} width={1920} height={1080} />
      <Still id="yt-poster-calib-6" component={() => <PosterCalib rank={14} />} width={1920} height={1080} />
      {/* любая колода: --props='{"rank":3}' */}
      <Still id="yt-poster-calib" component={PosterCalib} defaultProps={{rank: 15}} width={1920} height={1080} />
    </Folder>

    {/* Демо канала: все виды сцен на примере гайда (не для публикации) — motion-showcase/demo.ts */}
    <Folder name="yt-template-demo">
      <YtCompositions config={TEMPLATE_DEMO} />
    </Folder>

    {/* Витрина анимаций стиля: каждый приём движения отдельно, с подписью (не для публикации) */}
    <Folder name="motion-showcase">
      <Composition id="yt-motion-showcase" component={YtMotionShowcase} durationInFrames={YT_MOTION_SHOWCASE_DURATION} fps={30} width={1920} height={1080} />
      {/* «живой» арт: параллакс по карте глубины (core/fx/DepthArt.tsx), рендер с --gl=angle */}
      <Composition id="yt-depth-lab" component={DepthLab} defaultProps={{src: 'art/nathria.jpg'}} durationInFrames={DEPTH_LAB_DURATION} fps={60} width={1920} height={1080} />
      {/* раздача из колоды (looks/compendium/parts/deal.tsx): обычный ход и повтор ×0,5 */}
      <Composition id="yt-deal-lab" component={DealLab} durationInFrames={Math.round(DEAL_LAB_SEC * LAB_FPS)} fps={LAB_FPS} width={1920} height={1080} />
    </Folder>
  </>
);
