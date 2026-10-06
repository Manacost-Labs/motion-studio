// Тезисы — сцена стиля (looks/compendium/scenes/points.tsx); сторона Hearthstone справа — карта или портрет героя
import React from 'react';
import {pointsScene} from '../../../looks/compendium/scenes/points';
import {CardRow, HeroPortrait} from './parts';
import type {HsSide} from './types';
const HsAside: React.FC<{side: HsSide}> = ({side}) =>
  'card' in side ? <CardRow cards={[{id: side.card, at: 14}]} x={1150} w={700} cy={540} h={680} /> : <HeroPortrait hero={side.hero} cx={1500} cy={540} w={480} h={580} at={14} />;

export const points = pointsScene<HsSide>(HsAside);
