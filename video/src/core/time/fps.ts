// Ролик считает время в «кадрах-30»: все длительности и привязки (ZIN 26, OVL 18, at + 14…) — при 30 к/с.
// Ролик можно рендерить и в 60 к/с (config.fps): движок (core/video/VoicedVideo.tsx) кладёт в контекст множитель K = fps / 30, детали берут время
// через useFrame() — тот же счёт «кадров-30», только дробный, поэтому движение считается на каждом из 60 кадров.
// Sequence и звук работают в настоящих кадрах: from/durationInFrames умножаются на K (useK).
// Без провайдера K = 1 — детали работают и в чужих композициях (витрины) без изменений.
import {createContext, useContext} from 'react';
import {useCurrentFrame} from 'remotion';

export const BASE_FPS = 30;
const Scale = createContext(1);
export const FrameScale = Scale.Provider;
export const useK = () => useContext(Scale);
export const useFrame = () => useCurrentFrame() / useContext(Scale);
