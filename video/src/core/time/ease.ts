// Кривые и «рампы» движения. Вход — быстрый старт и долгое торможение, выход — наоборот,
// переезд камеры — мягко с обеих сторон. ramp(f, a, b) — 0…1 между кадрами a и b (за краями — зажато).
import {Easing, interpolate} from 'remotion';

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE = {out: EASE_OUT, in: EASE_IN, inOut: EASE_IN_OUT};

// interpolate без вылета за края диапазона
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ramp = (f: number, a: number, b: number, easing = EASE_OUT) => interpolate(f, [a, b], [0, 1], {...clamp, easing});
