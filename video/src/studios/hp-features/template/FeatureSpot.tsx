// Шаблон «ролик про новую функцию»: хук → логотип → сцены функции → (карусель) → финал.
// Весь ролик задаётся одним конфигом (пример — src/studios/hp-features/feature-matchups/config.ts). Звук и хронометраж считаются автоматически.
import React from 'react';
import {Composition} from 'remotion';
import {
  brandMusic,
  CAROUSEL_MOVE,
  CarouselItem,
  CarouselScene,
  cutCues,
  Cue,
  EndCardProps,
  EndCardScene,
  FeatureProps,
  FeatureScene,
  FPS,
  H,
  HookScene,
  HookProps,
  LogoScene,
  SFX,
  Spot,
  SpotScene,
  timeline,
  W,
} from '../../../hearthpulse';

export type FeatureSpotConfig = {
  hook: Omit<HookProps, 'dur'> & {dur?: number};
  logo?: {tagline?: string; dur?: number};
  // Одна или несколько сцен функции, по 110–150 кадров
  features: (Omit<FeatureProps, 'dur'> & {dur: number})[];
  carousel?: {kicker?: string; items: CarouselItem[]; dur?: number};
  end?: Omit<EndCardProps, 'dur'> & {dur?: number};
};

const buildScenes = (c: FeatureSpotConfig): SpotScene[] => [
  {id: 'hook', dur: c.hook.dur ?? 90, render: (dur) => <HookScene dur={dur} {...c.hook} />},
  {id: 'logo', dur: c.logo?.dur ?? 60, render: (dur) => <LogoScene dur={dur} tagline={c.logo?.tagline} />},
  ...c.features.map((f, i): SpotScene => ({id: `feature${i}`, dur: f.dur, render: (dur) => <FeatureScene {...f} dur={dur} />})),
  ...(c.carousel
    ? [{id: 'carousel', dur: c.carousel.dur ?? 30 * c.carousel.items.length, render: (dur: number) => <CarouselScene dur={dur} {...c.carousel!} />}]
    : []),
  {id: 'end', dur: c.end?.dur ?? 110, render: (dur) => <EndCardScene dur={dur} {...c.end} />},
];

const buildCues = (c: FeatureSpotConfig, scenes: SpotScene[]): Cue[] => {
  const {start} = timeline(scenes);
  const cues: Cue[] = [[SFX.heartbeat, start.logo + 4, 1], [SFX.impact, start.end - 2, 0.7], ...cutCues(scenes, ['logo', 'end'])];
  if (c.hook.cards?.length) cues.push([SFX.whoosh, 2, 0.7], [SFX.whoosh, 34, 0.45]);
  c.features.forEach((f, i) => {
    for (const p of f.panels) {
      const at = start[`feature${i}`] + (p.delay ?? 0);
      cues.push(p.from === 'scroll' ? [SFX.whoosh, at - 2, 0.35] : [SFX.pop, at, 0.4]);
    }
  });
  if (c.carousel) {
    const n = c.carousel.items.length;
    const slot = (c.carousel.dur ?? 30 * n) / n;
    for (let i = 1; i < n; i++) cues.push([SFX.whoosh, start.carousel + Math.round(i * slot - slot * CAROUSEL_MOVE), 0.3]);
  }
  return cues;
};

export const featureSpotDuration = (c: FeatureSpotConfig) => timeline(buildScenes(c)).total;

export const FeatureSpot: React.FC<{config: FeatureSpotConfig}> = ({config}) => {
  const scenes = buildScenes(config);
  const {start} = timeline(scenes);
  return <Spot scenes={scenes} cues={buildCues(config, scenes)} music={brandMusic(start.logo, start.end)} bug={['feature0', 'end']} />;
};

// Регистрация ролика по шаблону (в src/studios/hp-features/Root.tsx): композиции Feature-<id> (9:16) и Feature-<id>-16x9
export const FeatureCompositions: React.FC<{id: string; config: FeatureSpotConfig}> = ({id, config}) => {
  const dur = featureSpotDuration(config);
  return (
    <>
      <Composition id={`Feature-${id}`} component={FeatureSpot} defaultProps={{config}} durationInFrames={dur} fps={FPS} width={W} height={H} />
      <Composition id={`Feature-${id}-16x9`} component={FeatureSpot} defaultProps={{config}} durationInFrames={dur} fps={FPS} width={H} height={W} />
    </>
  );
};
