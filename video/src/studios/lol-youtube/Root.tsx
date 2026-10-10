// Студия «YouTube по League of Legends (канал — TODO)»: npm run studio:lol. Канал (стиль, бренд, игра, сцены) — ./channel.ts, ролики — ./videos.ts,
// паспорт студии — ./README.md, бриф — ./BRIEF.md. Заготовка — scripts/new-direction.mjs. Реестр студий — ../README.md
import React from 'react';
import {AbsoluteFill, Composition, Folder, Still} from 'remotion';
import {voicedCompositions} from '../../core/video/compositions';
import {BASE_FPS} from '../../core/time/fps';
import {YT_BASE} from '../../brands/lol-channel/channel';
import {channel, type LolConfig} from './channel';
import {VIDEOS} from './videos';
import {LolMotionLab, MOTION_LAB_SEC} from './MotionLab';
import {StyleA} from './style-frames/StyleA';
import {StyleB} from './style-frames/StyleB';
import {StyleC} from './style-frames/StyleC';

// Обложка 1280×720 — ЗАГЛУШКА до стиль-кадров (навык studio-new-direction, шаги 4–5): название ролика на ровном фоне
const Thumb: React.FC<{config: LolConfig}> = ({config}) => (
  <AbsoluteFill style={{background: '#ece6da', color: '#2b2621', justifyContent: 'center', alignItems: 'center', padding: 80, fontFamily: 'sans-serif', fontSize: 72, textAlign: 'center', whiteSpace: 'pre-line'}}>
    {config.thumb.title}
  </AbsoluteFill>
);
// Композиция ролика <id> (16:9, под голос) и обложки <id>-thumb, -thumb-b, -thumb-c (core/video/compositions.tsx)
const Compositions = voicedCompositions<LolConfig>(channel, Thumb);
// Частота пробы движения — как у роликов канала; в черновике (render.ps1 -Draft) — 30 к/с
const LAB_FPS = process.env.REMOTION_DRAFT ? BASE_FPS : YT_BASE.fps;

// Витрина стиля — ЗАГЛУШКА: фон стиля канала и подпись. Сюда — пробные стиль-кадры (шаг 4: npx remotion still … lol-showcase),
// потом витрина приёмов стиля. Не для публикации; в слепки yt-snap не входит (showcase в id)
const {Backdrop} = channel.look;
const Showcase: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', fontSize: 56, color: '#2b2621'}}>YouTube по League of Legends (канал — TODO) · стиль-кадры — TODO</AbsoluteFill>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    {/* Ролики канала — ./videos.ts */}
    {VIDEOS.map((config) => (
      <Folder key={config.id} name={config.id}>
        <Compositions config={config} />
      </Folder>
    ))}

    {/* Витрина стиля (не для публикации) */}
    <Folder name="showcase">
      <Still id="lol-showcase" component={Showcase} width={1920} height={1080} />
      {/* проба движения: маркер (looks/gazette/marker.tsx) и смена полос кляксой (looks/gazette/ink.tsx) — ./MotionLab.tsx */}
      <Composition id="lol-motion-lab" component={LolMotionLab} durationInFrames={Math.round(MOTION_LAB_SEC * LAB_FPS)} fps={LAB_FPS} width={1920} height={1080} />
    </Folder>

    {/* Стиль-кадры на выбор пользователя (один кадр «обзор патча — изменения чемпиона» в трёх стилях; ./style-frames,
        video/taste/lol.md). Не для публикации и не шаблон: после выбора стиль строится в src/looks, а эти кадры остаются образцом */}
    <Folder name="style-frames">
      <Still id="lol-style-a" component={StyleA} width={1920} height={1080} />
      <Still id="lol-style-b" component={StyleB} width={1920} height={1080} />
      <Still id="lol-style-c" component={StyleC} width={1920} height={1080} />
    </Folder>
  </>
);
