// Второй бренд — Манакост (hs-manacost.ru): YouTube-ролики по статьям сайта (шаблон src/templates/youtube).
// Движение, шрифты, золото и пергамент — общие с HearthPulse. Свои у Манакоста: почти чёрный синий фон сайта,
// синий цвет маны, логотип-табличка с волком и фирменный приём — кристалл маны (вместо кардиограммы).
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, DISPLAY} from './theme';
import {clamp} from './components';

export const MC = {
  night: '#03080C', // фон сайта
  deep: '#0A1B28', // тонировка артов
  navy: '#10283A', // подложки панелей
  mana: '#2A77BF', // синий бренда (цвет темы сайта)
  manaBright: '#6CC6FF', // свечение кристалла
  manaPale: '#CDEFFF',
  line: 'rgba(108,198,255,0.28)', // тонкие рамки
};

export const MANACOST = {
  name: 'Манакост',
  site: 'hs-manacost.ru',
  tg: 't.me/manacost_ru',
  vk: 'vk.com/manacost',
  logo: 'brand/manacost/logo.png', // 321×234, не увеличивать больше ~1,3×
};

// Тонировка в тёмно-синий и виньетка поверх арта. Низ не уводим в чёрное — там субтитры
export const McGrade: React.FC<{dim: number}> = ({dim}) => (
  <>
    <AbsoluteFill style={{opacity: dim, background: `linear-gradient(180deg, ${MC.deep}ee 0%, ${MC.deep}b0 40%, ${MC.deep}c0 75%, ${MC.deep}d8 100%)`}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 100%)'}} />
  </>
);

// Арт на фоне: медленный наезд, размытие, тонировка Манакоста
export const McBg: React.FC<{src: string; dur: number; blur?: number; dim?: number; focus?: string; from?: number; to?: number}> = ({
  src,
  dur,
  blur = 0,
  dim = 0.7,
  focus = '50% 50%',
  from = 1.08,
  to = 1.2,
}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [from, to], clamp);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: MC.night}}>
      <Img
        src={staticFile(src)}
        style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: focus, transform: `scale(${s})`, filter: blur ? `blur(${blur}px)` : undefined}}
      />
      <McGrade dim={dim} />
    </AbsoluteFill>
  );
};

// Кристалл маны (как самоцвет стоимости карты). value — число внутри
export const ManaGem: React.FC<{size: number; value?: React.ReactNode; glow?: number; fontSize?: number; style?: React.CSSProperties}> = ({
  size,
  value,
  glow = 0,
  fontSize,
  style,
}) => {
  const id = React.useId().replace(/:/g, '');
  const h = size * 1.1;
  return (
    <div style={{position: 'relative', width: size, height: h, flexShrink: 0, ...style}}>
      <svg
        viewBox="0 0 100 110"
        width={size}
        height={h}
        style={{position: 'absolute', inset: 0, overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px ${MC.manaBright})` : undefined}}
      >
        <defs>
          <linearGradient id={`${id}t`} x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#5FB9F2" />
            <stop offset="1" stopColor="#1F66AE" />
          </linearGradient>
        </defs>
        <polygon points="50,2 96,28 96,82 50,108 4,82 4,28" fill="#0B3F78" stroke="#041629" strokeWidth={5} strokeLinejoin="round" />
        <polygon points="4,28 50,2 50,22 22,38" fill="#A6E2FF" />
        <polygon points="50,2 96,28 78,38 50,22" fill="#62BBF0" />
        <polygon points="96,28 96,82 78,72 78,38" fill="#2F86CF" />
        <polygon points="96,82 50,108 50,88 78,72" fill="#1A5FA6" />
        <polygon points="50,108 4,82 22,72 50,88" fill="#2470B8" />
        <polygon points="4,82 4,28 22,38 22,72" fill="#4FA6E6" />
        <polygon points="50,22 78,38 78,72 50,88 22,72 22,38" fill={`url(#${id}t)`} />
        <polygon points="24,39 50,24 50,31 30,43" fill="#fff" opacity={0.55} />
      </svg>
      {value !== undefined && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: size * 0.03,
            fontFamily: DISPLAY,
            fontSize: fontSize ?? size * 0.56,
            lineHeight: 1,
            color: '#fff',
            WebkitTextStroke: `${Math.max(2, size * 0.05)}px #061A30`,
            paintOrder: 'stroke fill',
            textShadow: `0 ${size * 0.035}px 0 #061A30`,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
};

// Переход между сценами: вспышка маны с кристаллом. Пик — на середине (стык сцен), len кадров
export const ManaCut: React.FC<{len?: number}> = ({len = 18}) => {
  const f = useCurrentFrame();
  const t = f / len;
  const veil = interpolate(t, [0, 0.45, 0.55, 1], [0, 0.85, 0.85, 0], clamp);
  const flash = interpolate(t, [0.2, 0.5, 0.9], [0, 1, 0], clamp);
  const s = interpolate(t, [0, 0.5, 1], [0.3, 1.1, 2.4], clamp);
  const o = interpolate(t, [0.1, 0.4, 0.65, 1], [0, 1, 0.9, 0], clamp);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', alignItems: 'center', justifyContent: 'center'}}>
      <AbsoluteFill style={{background: MC.night, opacity: veil}} />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, ${MC.manaPale} 0%, ${MC.mana}aa 18%, transparent 55%)`, opacity: flash * 0.8}} />
      <ManaGem size={150} glow={34} style={{opacity: o, transform: `scale(${s}) rotate(${(t - 0.5) * 50}deg)`}} />
    </AbsoluteFill>
  );
};

// Логотип-табличка Манакоста с мягким синим свечением
export const McLogo: React.FC<{height: number; style?: React.CSSProperties}> = ({height, style}) => {
  const f = useCurrentFrame();
  const glow = 14 + 10 * (0.5 + 0.5 * Math.sin(f / 14));
  return (
    <Img
      src={staticFile(MANACOST.logo)}
      style={{height, filter: `drop-shadow(0 0 ${glow}px ${MC.mana}aa) drop-shadow(0 16px 30px rgba(0,0,0,0.6))`, ...style}}
    />
  );
};

// Золотое слово «Манакост» — как на фоне сайта
export const McWordmark: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => (
  <div
    style={{
      fontFamily: DISPLAY,
      fontSize: size,
      lineHeight: 1,
      color: C.goldBright,
      WebkitTextStroke: `${Math.round(size * 0.06)}px ${MC.night}`,
      paintOrder: 'stroke fill',
      textShadow: `0 ${size * 0.05}px 0 ${MC.night}, 0 0 30px rgba(0,0,0,0.7)`,
      ...style,
    }}
  >
    {MANACOST.name}
  </div>
);
