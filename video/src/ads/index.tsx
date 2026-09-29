// Реестр готовых роликов: у каждого своя папка в src/ads и свой <Folder> в Remotion Studio.
// Готовые ролики закреплены (frozen.json + эталонные кадры в <папка>/ref): после правок в src/brand
// запускай node scripts/check-ads.mjs. Описание роликов и порядок работы — README.md рядом.
import React from 'react';
import {Composition, Folder, Still} from 'remotion';
import {PosterCalib} from '../templates/youtube/PosterCalib';
import {FPS, H, W} from '../brand';
import {FeatureCompositions} from '../templates/feature/FeatureSpot';
import {AD_DURATION, HearthPulseAd} from './launch30/Ad';
import {LiveId} from './launch30/live';
import {Plate} from './launch30/scenes';
import {MATCHUPS} from './feature-matchups/config';
import {LibraryShowcase, SHOWCASE_DURATION} from './library-showcase/Showcase';
import {YtCompositions} from '../templates/youtube/YtVideo';
import {TEMPLATE_DEMO} from '../templates/youtube/demo';
import {LEGEND_DECKS_SEP26} from './yt-legend-decks-sep26/config';

const PLATES: LiveId[] = ['hook', 'standard', 'cards', 'arena', 'bg', 'end'];

export const AdCompositions: React.FC = () => (
  <>
    {/* Основной рекламный ролик, 36 с */}
    <Folder name="launch30">
      <Composition id="HearthPulseAd" component={HearthPulseAd} durationInFrames={AD_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="HearthPulseAd16x9" component={HearthPulseAd} durationInFrames={AD_DURATION} fps={FPS} width={H} height={W} />
      {/* Стартовые кадры для оживления в Higgsfield */}
      <Folder name="launch30-plates">
        {PLATES.map((id) => (
          <React.Fragment key={id}>
            <Composition id={`plate-${id}`} component={() => <Plate id={id} />} durationInFrames={150} fps={FPS} width={W} height={H} />
            <Composition id={`plate-h-${id}`} component={() => <Plate id={id} />} durationInFrames={150} fps={FPS} width={H} height={W} />
          </React.Fragment>
        ))}
      </Folder>
    </Folder>

    {/* Анонс «Матчапы» по шаблону «новая функция» */}
    <Folder name="feature-matchups">
      <FeatureCompositions id="Matchups" config={MATCHUPS} />
    </Folder>

    {/* Витрина библиотеки ассетов (public/lib) */}
    <Folder name="library-showcase">
      <Composition id="Library-Showcase" component={LibraryShowcase} durationInFrames={SHOWCASE_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="Library-Showcase-16x9" component={LibraryShowcase} durationInFrames={SHOWCASE_DURATION} fps={FPS} width={H} height={W} />
    </Folder>

    {/* YouTube (Манакост): «15 колод для Легенды в сентябре» по статье hs-manacost.ru — черновик, не закреплён */}
    <Folder name="yt-legend-decks-sep26">
      <YtCompositions config={LEGEND_DECKS_SEP26} />
    </Folder>

    {/* Калибровка геометрии постеров колод (см. src/templates/youtube/README.md) */}
    <Folder name="yt-poster-calib">
      <Still id="yt-poster-calib-8" component={() => <PosterCalib rank={15} />} width={1920} height={1080} />
      <Still id="yt-poster-calib-6" component={() => <PosterCalib rank={14} />} width={1920} height={1080} />
      {/* любая колода: --props='{"rank":3}' */}
      <Still id="yt-poster-calib" component={PosterCalib} defaultProps={{rank: 15}} width={1920} height={1080} />
    </Folder>

    {/* Демо YouTube-шаблона: все виды сцен на примере гайда (не для публикации) */}
    <Folder name="yt-template-demo">
      <YtCompositions config={TEMPLATE_DEMO} />
    </Folder>
  </>
);
