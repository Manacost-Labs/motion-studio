// Сцены Hearthstone (стиль «Компендиум»): у каждой — компонент и правила (SceneDef, core/video/registry.ts) в её файле.
// Канал перечисляет нужные в своём channel.ts вместе со сценами стиля (looks/compendium/scenes)
export {hook, HookScene} from './hook';
export {deck, DeckScene} from './deck';
export {cards, CardsScene} from './cards';
export {mulligan, MulliganScene, TONE} from './mulligan';
export {matchups, MatchupsScene} from './matchups';
export {points} from './points';
export {Thumb, type ThumbSpec} from './thumb';
export type * from './types';
