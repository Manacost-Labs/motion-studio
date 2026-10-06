// Сцены стиля «Компендиум» без игры: у каждой — компонент и правила (SceneDef, core/video/registry.ts) в её файле.
// Канал перечисляет нужные в своём channel.ts (studios/<студия>/channel.ts); бренд и игра приходят через ctx канала
export {intro, IntroScene} from './intro';
export {outro, OutroScene, recapTurn} from './outro';
export {points, pointsScene, PointsScene, type PointsAside} from './points';
export {image, ImageScene} from './image';
export {DIVIDER, divider, DividerScene} from './divider';
