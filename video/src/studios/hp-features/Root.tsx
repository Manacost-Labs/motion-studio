// Студия обзоров новых функций HearthPulse: npm run studio:features. Шаблон — ./template, бренд — src/hearthpulse.
// Новый обзор: папка <функция>/config.ts + <Folder> ниже. Реестр — ../README.md
import React from 'react';
import {Folder} from 'remotion';
import {FeatureCompositions} from './template/FeatureSpot';
import {MATCHUPS} from './feature-matchups/config';

export const Root: React.FC = () => (
  <>
    {/* Анонс «Матчапы» */}
    <Folder name="feature-matchups">
      <FeatureCompositions id="Matchups" config={MATCHUPS} />
    </Folder>
  </>
);
