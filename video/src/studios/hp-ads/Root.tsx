// Студия рекламы HearthPulse: npm run studio:ads. Бренд — src/hearthpulse (video/BRAND.md), реестр — ../README.md.
// Закреплённые ролики (../frozen.json): после правок в src/hearthpulse запускай node scripts/check-ads.mjs
import React from 'react';
import {Composition, Folder} from 'remotion';
import {FPS, H, W} from '../../hearthpulse';
import {AD_DURATION, HearthPulseAd} from './launch30/Ad';
import {LiveId} from './launch30/live';
import {Plate} from './launch30/scenes';
import {LibraryShowcase, SHOWCASE_DURATION} from './library-showcase/Showcase';
import {MOTION_SHOWCASE_DURATION, MotionShowcase} from './motion-showcase/Showcase';

const PLATES: LiveId[] = ['hook', 'standard', 'cards', 'arena', 'bg', 'end'];

export const Root: React.FC = () => (
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

    {/* Витрина библиотеки ассетов (public/lib) */}
    <Folder name="library-showcase">
      <Composition id="Library-Showcase" component={LibraryShowcase} durationInFrames={SHOWCASE_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="Library-Showcase-16x9" component={LibraryShowcase} durationInFrames={SHOWCASE_DURATION} fps={FPS} width={H} height={W} />
    </Folder>

    {/* Витрина анимаций: каждый приём движения из src/hearthpulse отдельно, с подписью */}
    <Folder name="motion-showcase">
      <Composition id="Motion-Showcase" component={MotionShowcase} durationInFrames={MOTION_SHOWCASE_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="Motion-Showcase-16x9" component={MotionShowcase} durationInFrames={MOTION_SHOWCASE_DURATION} fps={FPS} width={H} height={W} />
    </Folder>
  </>
);
