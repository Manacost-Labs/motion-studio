// Звуковая раскладка основного ролика. Музыка music-v3.m4a: вступительный удар на кадре 86 (стык хука
// и логотипа), финальный удар на кадре 1020 (цена в финале). Эффекты стоят на долях — там же, где анимации.
import {CAROUSEL_MOVE, cutCues, Cue, MusicSpec, SFX} from '../../../hearthpulse';
import {b, DUR, SCENE_ORDER, START, TOTAL, FINAL_HIT} from './timeline';

const slot = DUR.montage / 4;

export const CUES: Cue[] = [
  // Карты летят в камеру
  [SFX.whoosh, 2, 0.7],
  [SFX.whoosh, 34, 0.45],
  // Пульс логотипа — вместе с ударом музыки
  [SFX.heartbeat, START.logo + 2, 0.7],
  ...cutCues(
    SCENE_ORDER.map((id) => ({id, dur: DUR[id]})),
    ['logo', 'end'],
  ),
  // Появление панелей
  ...[
    START.standard + b(1),
    START.standard + b(2),
    START.matchups + b(1),
    START.cards + b(0.5),
    START.arena + b(1),
    START.bg + b(1),
    START.bg + b(4),
    START.minion + b(0.5),
  ].map((f): Cue => [SFX.pop, f, 0.4]),
  // Курсор наводится на карту
  [SFX.pop, START.cards + b(3), 0.3],
  // Прокрутки страницы и смена разделов в карусели
  [SFX.whoosh, START.standard + b(6) - 2, 0.35],
  [SFX.whoosh, START.arena + b(6) - 2, 0.35],
  [SFX.whoosh, START.minion + b(3), 0.25],
  ...[1, 2, 3].map((i): Cue => [SFX.whoosh, START.montage + Math.round(i * slot - slot * CAROUSEL_MOVE), 0.3]),
  // Подкрепляем финальный удар музыки
  [SFX.impact, START.end + FINAL_HIT - 1, 0.45],
];

export const MUSIC: MusicSpec = {file: 'music-v3.m4a', start: 0, fadeEnd: TOTAL + 40, volume: 0.8};
