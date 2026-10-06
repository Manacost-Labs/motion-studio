// Сегменты сцен стиля «Компендиум» (вступление, тезисы, скриншот, разделитель, финал) и что стилю нужно из
// контекста канала (ctx: channel.context, core/video/registry.ts). Игры здесь нет: гербы, сторона тезисов, строки
// итоговой таблицы приходят от канала (у Манакоста — games/hearthstone/scenes через studios/manacost-youtube/channel.ts).
// Весь текст диктора — в поле vo; всё, что появляется «под голос», привязывается к фразе из vo (поле at)
import type {BaseSeg, Point} from '../../core/video/types';
import type {RecapRow} from './parts/recap';

// Общее у сцен стиля: поля движка + персонаж и подсветка
export type Base = Omit<BaseSeg, 'kind'> & {
  mural?: string; // полупрозрачный персонаж (вырезка из public, например chars/warlock.png)
  highlight?: string[]; // слова, которые в субтитрах подсвечиваются (запас на будущее)
};

// Вступление: classes — ключи гербов (у Hearthstone — классы подборки) по очереди строкой под заголовком, картинку герба
// даёт ctx.crest; tease — картинки из public (постеры топа), которые мелькают под размытием: интрига, кто на вершине;
// teaseAt — фраза, на которой появляются постеры tease (без неё — с середины речи)
export type IntroSeg = Base & {kind: 'intro'; kicker: string; title: string; sub?: string; classes?: string[]; tease?: string[]; teaseAt?: string};

// Тезисы (советы, план на игру) и картинка справа: изображение из public или сторона игры (Side — у Hearthstone карта
// или герой, рисует игра: scenes/points.tsx → pointsScene)
export type PointsSeg<Side = never> = Base & {
  kind: 'points';
  kicker?: string;
  title: string;
  points: Point[];
  side?: {image: string} | Side;
};

// Скриншот (сайт, Reddit, игра): кадр с медленным наездом, подпись и автор
export type ImageSeg = Base & {kind: 'image'; kicker?: string; title?: string; src: string; caption?: string; credit?: string; focus?: string};

// recap — финал открывается итоговой таблицей (строки — ctx.recap, собирает канал); на фразе to
// страница перелистывается на прощание и места под конечную заставку YouTube
export type OutroSeg = Base & {kind: 'outro'; title: string; links: {label: string; text: string}[]; recap?: {to: string; kicker?: string; title: string}};

// Разделитель блоков (без голоса, ~2,5 с, музыка без приглушения): «Дальше» + «Топ-10» и ряд медалей мест блока
// block — места блока от и до (например [10, 6]). В главы описания не попадает — входит в следующую главу
export type DividerSeg = Base & {kind: 'divider'; kicker?: string; title: string; block: [number, number]};

// ─── Контекст канала ───
// Бренд канала: шапка вступления и финала (site — надзаголовок, name — заголовок, logo — картинка из public),
// defaultMural — персонаж вступления, если в сегменте нет своего; sealRing — надпись по кругу сургучной печати топа,
// leaderLabel — пометка №1 (заставка места, печать, итоговая таблица)
export type CompendiumBrand = {name: string; site: string; logo: string; defaultMural?: string; sealRing?: string; leaderLabel?: string};

// Места топа: место каждого сегмента (шапка следующей сцены прокручивает номер с него) и «из скольких»
export type RankCtx = {ranks?: (number | undefined)[]; rankOf?: number};

// Всё, что сценам стиля нужно от канала: места, бренд, герб по ключу (crest) и строки итоговой таблицы финала (recap)
export type CompendiumCtx = RankCtx & {brand: CompendiumBrand; crest?: (key: string) => string; recap?: RecapRow[]};
