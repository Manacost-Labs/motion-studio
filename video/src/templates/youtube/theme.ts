// Дизайн YouTube-роликов Манакоста — «Компендиум» в дизайн-системе HS-Arena (arena.hs-manacost.ru, design.md):
// пергамент — основной материал, красное тавернное сукно — шапки и плашки, дерево — рамы и разделители,
// золото — только мелкие акценты. Заголовки — HSDisplay (Belwe), текст — Inter. Ассеты — public/brand/arena.
// Движение «как руками»: маски, мягкие кривые, размытие в движении у камеры; без свечений, искр и неона.
import React from 'react';
import {Easing, interpolate, staticFile} from 'remotion';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';

export const {fontFamily: TEXT} = loadInter('normal', {weights: ['500', '600', '700', '800', '900'], subsets: ['cyrillic', 'latin']});

// Токены HS-Arena
export const H = {
  parchment: '#ead6a7',
  parchmentLight: '#f7e8bf',
  ink: '#30251c',
  inkMuted: '#735e49',
  wood: '#2e160b',
  woodSoft: '#5f371d',
  red: '#8d171d',
  redDark: '#5d0d13',
  gold: '#d9ab49',
  goldBright: '#efc96f',
  cream: '#fff0c8',
  positive: '#2f7a3e',
  negative: '#a33a3a',
  even: '#9a7417',
};

export const A = (f: string) => staticFile(`brand/arena/${f}`);

export const parchmentBg: React.CSSProperties = {
  backgroundColor: H.parchment,
  backgroundImage: `linear-gradient(rgba(249,235,202,.62), rgba(236,213,166,.7)), url(${A('arena-parchment.jpg')})`,
  backgroundRepeat: 'repeat',
  backgroundSize: 'auto, 1100px 1117px',
};
export const redBg: React.CSSProperties = {
  backgroundImage: `linear-gradient(90deg, rgba(69,5,9,.18), rgba(122,20,25,.12)), url(${A('arena-rail-red.jpg')})`,
  backgroundSize: 'auto, 560px 257px',
  backgroundRepeat: 'repeat',
};
// Деревянная рама (border-image из main-page-rail-border.png); fill — с деревянной заливкой внутри
export const timber = (w = 16, fill = false): React.CSSProperties => ({
  border: `${w}px solid transparent`,
  borderImageSource: `url(${A('main-page-rail-border.png')})`,
  borderImageSlice: fill ? '13 fill' : '13',
  borderImageWidth: `${w}px`,
  borderImageRepeat: 'stretch',
});
// Золотая компактная рама (deck-border.png)
export const goldFrame = (w = 8): React.CSSProperties => ({
  border: `${w}px solid transparent`,
  borderImageSource: `url(${A('deck-border.png')})`,
  borderImageSlice: '20',
  borderImageWidth: `${w}px`,
  borderImageRepeat: 'stretch',
});

// Кривые: вход — быстрый старт и долгое торможение, выход — наоборот, переезд камеры — мягко с обеих сторон
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ramp = (f: number, a: number, b: number, easing = EASE_OUT) => interpolate(f, [a, b], [0, 1], {...clamp, easing});
