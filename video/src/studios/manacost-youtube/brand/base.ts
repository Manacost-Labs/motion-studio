import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Основа роликов Манакоста — своя, не из бренда HearthPulse: можно менять, не задевая рекламу HP
loadFont({family: 'HSDisplay', url: staticFile('brand/HSDisplay.otf')});
export const DISPLAY = 'HSDisplay, serif';

export const FPS = 30;
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
