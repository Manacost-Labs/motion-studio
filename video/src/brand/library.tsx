// Библиотека ассетов HearthPulse (public/lib). Оригинальный стиль «коллекционной карточной игры»,
// без чужих персонажей — можно оживлять в Higgsfield без отказов по авторским правам.
// Каталог с превью — video/LIBRARY.md, промпты и размеры — public/lib/manifest.json.
import React from 'react';
import {AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {C} from './theme';
import {Char, clamp, Grade, useEnter, useFrameSize} from './components';

// Локации: у каждой есть вертикальный (-v) и горизонтальный (-h) фон
export const LIB_SCENES = [
  'tavern',
  'arena',
  'library',
  'crystal-cave',
  'forge',
  'frozen-citadel',
  'jungle-temple',
  'night-sky',
  'game-board',
  'treasure-vault',
  'inn-exterior',
  'battlefield',
] as const;
export type LibScene = (typeof LIB_SCENES)[number];

// Живые зацикленные фоны (9:16, 30 fps, 136 кадров, хвост сведён с началом — повтор без шва)
export const LOOP_FRAMES = 136;
export const LIB_LOOPS = ['tavern', 'arena', 'library', 'crystal-cave', 'night-sky'] as const;
export type LibLoop = (typeof LIB_LOOPS)[number];

export const LIB_CHARS = [
  'dwarf-innkeeper',
  'elf-ranger',
  'orc-berserker',
  'gnome-tinker',
  'necromancer',
  'paladin',
  'troll-shaman',
  'druid',
  'pirate-rogue',
  'goblin-merchant',
  'frost-mage',
  'priestess',
  'mech-bot',
  'dragon-whelp',
] as const;
export type LibChar = (typeof LIB_CHARS)[number];

export const LIB_PROPS = [
  'card-back',
  'card-frame',
  'gold-frame',
  'ribbon-banner',
  'chest-open',
  'coins-pile',
  'mana-gem',
  'trophy',
  'scroll',
  'spellbook',
  'potion',
  'icon-arena',
  'icon-tavern',
  'icon-standard',
  'icon-wild',
  'icon-legend',
  'icon-stats',
  'icon-matchups',
] as const;
export type LibProp = (typeof LIB_PROPS)[number];

export const LIB_FX = ['sparkle-burst', 'magic-smoke', 'god-rays', 'gold-dust'] as const;
export type LibFx = (typeof LIB_FX)[number];

export const LIB_MUSIC = ['epic-45', 'tavern-30', 'hype-15', 'announce-20', 'mystic-30'] as const;
export const LIB_SFX = [
  'card-draw',
  'card-shuffle',
  'coin-single',
  'coin-pile',
  'gem-sparkle',
  'level-up',
  'magic-whoosh',
  'riser',
  'drum-hit',
  'fanfare',
  'notification',
  'page-turn',
  'scroll-unroll',
  'sword-clash',
  'fire-crackle',
  'tavern-crowd',
  'ui-click',
  'bell',
  'stone-slide',
] as const;

// ─── Пути ───
export const libArt = (id: LibScene) => ({v: `lib/bg/${id}-v.png`, h: `lib/bg/${id}-h.png`});
// Живой фон для FeatureScene/Backdrop: зацикливается на любую длину сцены
export const libLoop = (id: LibLoop) => ({v: `lib/loops/${id}-v.mp4`, loop: true, len: LOOP_FRAMES});
export const libChar = (id: LibChar) => `lib/chars/${id}.png`;
export const libProp = (id: LibProp) => `lib/props/${id}.png`;
export const libFx = (id: LibFx) => `lib/fx/${id}.png`;
export const libMusic = (id: (typeof LIB_MUSIC)[number]) => `lib/music/${id}.m4a`;
export const libSfx = (id: (typeof LIB_SFX)[number]) => `lib/sfx/${id}.wav`;

// ─── Компоненты ───

// Зацикленное видео (живой фон) на любую длину
export const LoopVideo: React.FC<{src: string; loopFrames?: number; style?: React.CSSProperties}> = ({src, loopFrames = LOOP_FRAMES, style}) => (
  <Loop durationInFrames={loopFrames}>
    <OffthreadVideo src={staticFile(src)} muted style={{width: '100%', height: '100%', objectFit: 'cover', ...style}} />
  </Loop>
);

// Локация целиком: живой фон (если есть и кадр вертикальный) или картинка с медленным наездом + тонировка бренда
export const LibBackdrop: React.FC<{id: LibScene; dur: number; dim?: number; blur?: number; live?: boolean}> = ({id, dur, dim = 0.6, blur = 0, live = true}) => {
  const f = useCurrentFrame();
  const {wide} = useFrameSize();
  const s = interpolate(f, [0, dur], [1.04, 1.12], clamp);
  const hasLoop = !wide && live && (LIB_LOOPS as readonly string[]).includes(id);
  const filter = blur ? `blur(${blur}px)` : undefined;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: C.night}}>
      <AbsoluteFill style={{transform: `scale(${s})`}}>
        {hasLoop ? (
          <LoopVideo src={`lib/loops/${id}-v.mp4`} style={{filter}} />
        ) : (
          <Img src={staticFile(wide ? libArt(id).h : libArt(id).v)} style={{width: '100%', height: '100%', objectFit: 'cover', filter}} />
        )}
      </AbsoluteFill>
      <Grade dim={dim} />
    </AbsoluteFill>
  );
};

// Герой библиотеки — та же анимация появления и «дыхания», что у Char
export const LibChar: React.FC<Omit<React.ComponentProps<typeof Char>, 'src'> & {id: LibChar}> = ({id, ...rest}) => <Char src={libChar(id)} {...rest} />;

// Предмет: появляется, мягко покачивается и светится
export const LibProp: React.FC<{id: LibProp; x: number; y: number; size: number; delay?: number; glow?: string; spin?: number}> = ({
  id,
  x,
  y,
  size,
  delay = 0,
  glow = C.goldBright,
  spin = 0,
}) => {
  const f = useCurrentFrame();
  const p = useEnter(delay, 18);
  const bob = Math.sin((f - delay) / 18) * 8;
  return (
    <Img
      src={staticFile(libProp(id))}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        opacity: p,
        transform: `translateY(${bob + (1 - p) * 40}px) scale(${0.7 + 0.3 * p}) rotate(${spin * Math.sin((f - delay) / 30)}deg)`,
        filter: `drop-shadow(0 0 ${24 + 10 * Math.sin(f / 12)}px ${glow}66) drop-shadow(0 20px 30px rgba(0,0,0,0.5))`,
      }}
    />
  );
};

// Световой эффект на чёрном фоне, накладывается «экраном»: вспыхивает на кадре at и гаснет
export const LibFx: React.FC<{id: LibFx; at?: number; len?: number; opacity?: number}> = ({id, at = 0, len = 30, opacity = 0.9}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + 6, at + len], [0, opacity, 0], clamp);
  const s = interpolate(f, [at, at + len], [0.95, 1.08], clamp);
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: o, pointerEvents: 'none'}}>
      <Img src={staticFile(libFx(id))} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`}} />
    </AbsoluteFill>
  );
};
