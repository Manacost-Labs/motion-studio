// Сцена: пути к картинкам карт, звуки, классы (герой, герб), зерно плёнки, тёплая виньетка
import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile} from 'remotion';
import {A} from '../theme';
import {useFrame, useK} from '../fps';

export const hsTile = (id: string) => staticFile(`hs/tiles/${id}.png`);
export const hsRender = (id: string) => staticFile(`hs/render/${id}.png`);
export const hsArt = (id: string) => `hs/art/${id}.jpg`;

// Звуковой эффект из public (например lib/sfx/card-draw.wav) на кадре at
// at — в «кадрах-30» (fps.ts), Sequence — в настоящих кадрах ролика
export const Sfx: React.FC<{file: string; at: number; volume?: number}> = ({file, at, volume = 0.3}) => {
  const K = useK();
  return (
    <Sequence from={Math.max(0, Math.round(at * K))} durationInFrames={90 * K} layout="none">
      <Html5Audio src={staticFile(file)} volume={volume} />
    </Sequence>
  );
};

// Класс: понимает и WARRIOR, и «Воин». Даёт базового героя (портрет) и герб (class_icon HS-Arena)
const RU_CLASS: Record<string, string> = {
  воин: 'WARRIOR',
  шаман: 'SHAMAN',
  разбойник: 'ROGUE',
  паладин: 'PALADIN',
  охотник: 'HUNTER',
  друид: 'DRUID',
  чернокнижник: 'WARLOCK',
  маг: 'MAGE',
  жрец: 'PRIEST',
  'охотник на демонов': 'DEMONHUNTER',
  дх: 'DEMONHUNTER',
  'рыцарь смерти': 'DEATHKNIGHT',
  дк: 'DEATHKNIGHT',
};
const HERO: Record<string, string> = {
  WARRIOR: 'HERO_01',
  SHAMAN: 'HERO_02',
  ROGUE: 'HERO_03',
  PALADIN: 'HERO_04',
  HUNTER: 'HERO_05',
  DRUID: 'HERO_06',
  WARLOCK: 'HERO_07',
  MAGE: 'HERO_08',
  PRIEST: 'HERO_09',
  DEMONHUNTER: 'HERO_10',
  DEATHKNIGHT: 'HERO_11',
};
export const classKey = (cls: string) => (HERO[cls.toUpperCase()] ? cls.toUpperCase() : RU_CLASS[cls.toLowerCase()] ?? 'WARRIOR');
export const heroFor = (cls: string) => HERO[classKey(cls)];
export const crestFor = (cls: string) => A(`class_icon/${classKey(cls).toLowerCase()}.png`);

// Зерно плёнки: мелкий шум меняется каждый кадр
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.05}) => {
  const f = useFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity}}>
      <svg width="960" height="540" style={{width: '100%', height: '100%'}} preserveAspectRatio="none">
        <filter id="yt-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="960" height="540" filter="url(#yt-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// Тёплая виньетка по краям пергамента
export const Vignette: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(70,38,12,0.28) 100%)'}} />
);
