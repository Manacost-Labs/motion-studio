// Хронометраж основного ролика (30 fps). Стыки сцен стоят на сильных долях музыки music-v3.m4a:
// ≈152 BPM, доля 11,84 кадра, такт 47,4 кадра; вступительный удар — кадр 86, финальный — кадр 1020.
// Внутри сцен события считаются в долях: b(3) — третья доля от начала сцены.
import {timeline} from '../../../hearthpulse';

export const SCENE_ORDER = ['hook', 'logo', 'standard', 'matchups', 'cards', 'arena', 'bg', 'minion', 'montage', 'end'] as const;
export type SceneId = (typeof SCENE_ORDER)[number];

export const BEAT = 11.842;
export const b = (n: number) => Math.round(n * BEAT);

// Кадры стыков (сильные доли) и конец ролика
const CUT: Record<SceneId, number> = {
  hook: 0,
  logo: 86,
  standard: 134,
  matchups: 276,
  cards: 371,
  arena: 465,
  bg: 607,
  minion: 749,
  montage: 844,
  end: 986,
};
const END_FRAME = 1090;
// Финальный удар музыки — от начала финальной заставки
export const FINAL_HIT = 1020 - CUT.end;

export const DUR = Object.fromEntries(
  SCENE_ORDER.map((id, i) => [id, (i < SCENE_ORDER.length - 1 ? CUT[SCENE_ORDER[i + 1]] : END_FRAME) - CUT[id]]),
) as Record<SceneId, number>;

const t = timeline(SCENE_ORDER.map((id) => ({id, dur: DUR[id]})));
export const START = t.start as Record<SceneId, number>;
export const TOTAL = t.total;
