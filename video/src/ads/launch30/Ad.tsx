// Основной ролик HearthPulse (композиции HearthPulseAd и HearthPulseAd16x9)
import React from 'react';
import {Spot, SpotScene} from '../../brand';
import {Arena, Battlegrounds, Cards, End, Hook, Logo, Matchups, Minion, Montage, Standard} from './scenes';
import {CUES, MUSIC} from './audio';
import {DUR, SCENE_ORDER, SceneId, TOTAL} from './timeline';

const RENDER: Record<SceneId, React.FC<{dur: number}>> = {
  hook: Hook,
  logo: Logo,
  standard: Standard,
  matchups: Matchups,
  cards: Cards,
  arena: Arena,
  bg: Battlegrounds,
  minion: Minion,
  montage: Montage,
  end: End,
};

const SCENES: SpotScene[] = SCENE_ORDER.map((id) => {
  const Scene = RENDER[id];
  return {id, dur: DUR[id], render: (dur) => <Scene dur={dur} />};
});

export const AD_DURATION = TOTAL;

export const HearthPulseAd: React.FC = () => <Spot scenes={SCENES} cues={CUES} music={MUSIC} bug={['standard', 'end']} />;
