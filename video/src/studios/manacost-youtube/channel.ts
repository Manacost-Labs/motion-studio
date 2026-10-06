// Канал «Манакост · YouTube»: стиль «Компендиум» (src/looks/compendium), бренд manacost (src/brands/manacost),
// игра hearthstone (src/games/hearthstone) и все виды сцен канала. Отсюда — тип конфига ролика (YtConfig = ConfigOf<typeof
// channel>), каркас ролика по статье (articleDeck, divider, manacostOutro, YT_BASE), пороги проверок (LIMITS) и проверки
// канала (qa → core/qa/audit.ts). Регистрация композиций — ./Root.tsx (core/video/compositions.tsx → VoicedVideo).
// Новая сцена = файл со сценой (компонент + defineScene): без игры — looks/compendium/scenes, с игрой —
// games/hearthstone/scenes; + строка в scenes ниже.
// ctx сцен собирается здесь: места топа (игра), бренд канала, гербы классов и строки итоговой таблицы (игра для стиля)
import {defineChannel, fields, type ConfigOf, type SegOf} from '../../core/video/registry';
import type {VoicedTiming} from '../../core/video/types';
import {VIDEO_LIMITS} from '../../core/qa/limits';
import {hsContext} from '../../games/hearthstone/data/ranks';
import {DECK_LIMITS, hsQa, THUMB_LIMITS} from '../../games/hearthstone/data/audit';
import {articleDeck as hsArticleDeck, divider as hsDivider, type ArticleData} from '../../games/hearthstone/data/article';
import {compendium} from '../../looks/compendium/look';
import type {CompendiumCtx, DividerSeg, OutroSeg} from '../../looks/compendium/types';
import {MANACOST, manacostOutro as brandOutro, YT_BASE as BRAND_BASE} from '../../brands/manacost/channel';
import {crestFor} from '../../games/hearthstone/scenes/parts/crest';
import {recapRow} from '../../games/hearthstone/scenes/parts/recap';
import type {ThumbSpec} from '../../games/hearthstone/scenes/thumb';
import type {DeckSeg} from '../../games/hearthstone/scenes/types';
import {divider as dividerScene, image, intro, outro} from '../../looks/compendium/scenes';
import {cards, deck, hook, matchups, mulligan, points} from '../../games/hearthstone/scenes';
import STUDIO_PRONOUNCE from './pronounce.json';

// Обложка (games/hearthstone/scenes/thumb.tsx): cards — 3 карты веером справа (последняя — передняя); hook — надпись
// на сургучной печати поверх веера
export type YtThumbSpec = ThumbSpec;

// Описание и поиск YouTube (scripts/yt-export.mjs, проверка — yt-qa): lead — первая строка описания (≤ 150 знаков, не повтор
// названия: о чём ролик и ключевые слова), hashtags — до трёх, без «#» (YouTube покажет их над названием), tags — теги
// (вместе ≤ 500 знаков, → tags.txt), titles — варианты названия для теста (→ titles.txt, каждый ≤ 70), playlist — куда
// добавить, pinnedComment — текст закреплённого комментария. Тон спокойный, без кликбейта и «!!!»
export type YtSeo = {lead: string; hashtags?: string[]; tags?: string[]; titles?: string[]; playlist?: string; pinnedComment?: string};

// Поля конфига канала сверх голоса (общие поля ролика под голос — VoicedConfig, core/video/types.ts:
// id, music, ambience, fps, subtitles, voice, pronounce, segments)
export type YtFields = {
  title: string; // название ролика на YouTube
  url?: string; // статья-источник
  // обложка (вариант A, композиция <id>-thumb)
  thumb: YtThumbSpec;
  // ещё до двух вариантов обложки в том же стиле для «Тест и сравнение» YouTube (B, C → <id>-thumb-b, <id>-thumb-c):
  // поля поверх thumb — другой hook (hook: '' — без печати), badge или карты. Лист читаемости — scripts/yt-thumb.mjs <id>
  thumbs?: Partial<YtThumbSpec>[];
  seo?: YtSeo;
};

export const channel = defineChannel({
  look: compendium,
  brand: 'manacost',
  game: 'hearthstone',
  context: (segs) => {
    const hs = hsContext(segs); // места топа и колоды итоговой таблицы
    const ctx: CompendiumCtx = {ranks: hs.ranks, rankOf: hs.rankOf, brand: MANACOST, crest: crestFor, recap: hs.decks.map(recapRow)};
    return {...hs, ...ctx};
  },
  fields: fields<YtFields>(),
  scenes: [hook, intro, deck, cards, mulligan, matchups, points, image, dividerScene, outro],
  // проверки канала (yt-qa): Hearthstone — обложка, гербы классов, словарь терминов; поверх него — словарь бренда ./pronounce.json
  qa: {...hsQa, pronounce: {...hsQa.pronounce, ...STUDIO_PRONOUNCE}},
});

// Конфиг ролика канала: голос (VoicedConfig) + поля канала + сегменты только тех видов, что есть в канале
// (scenes выше): сцена чужого вида не проходит tsc
export type YtConfig = ConfigOf<typeof channel>;
export type YtSegment = SegOf<typeof channel>;
// хронометраж (calculateMetadata → core/voice/calc.ts): всё в «кадрах-30»; base — их частота
export type YtTiming = VoicedTiming;

// ─── Ролик по статье hs-manacost.ru: всё одинаковое для каждого ролика — здесь, в конфиге ролика остаётся только текст ───
// article.json пишет scripts/fetch-article.mjs (+ постеры scripts/deck-posters.mjs); заготовку конфига — scripts/yt-new.mjs.
//
//   import {articleDeck, articleClasses, articleTease, divider, manacostOutro, YT_BASE, type YtConfig} from '../channel';
//   import article from './article.json';
//   const deck = (rank: number, text: DeckText) => articleDeck(article, rank, text);
//   segments: [hook, intro, deck(15, {...}), …, divider(10, 6), deck(10, {...}), …, manacostOutro()]
//
// Сами функции — в игровом наборе (games/hearthstone/data/article.ts) и бренде (brands/manacost/channel.ts); здесь они
// получают типы сцен канала
export type {ArticleData, ArticleDeck} from '../../games/hearthstone/data/article';
export {articleClasses, articleTease, dividerRanks} from '../../games/hearthstone/data/article';

// Текст колоды, который пишет автор (остальное — из статьи)
export type DeckText = Pick<DeckSeg, 'vo'> & Partial<Pick<DeckSeg, 'mural' | 'chapter' | 'cards' | 'points' | 'vs' | 'inserts'>>;
// колода №rank из статьи + текст автора
export const articleDeck = (article: ArticleData, rank: number, text: DeckText): DeckSeg => hsArticleDeck(article, rank, text);
// разделитель блоков топа: «Дальше — топ-<to>», медали мест from…to
export const divider = (from: number, to: number, title?: string): DividerSeg => hsDivider(from, to, title);
// финал Манакоста: итоговая таблица всех колод, на «Подписывайтесь» — конечная заставка YouTube
export const manacostOutro = (opts: {kicker: string; title?: string; vo?: string}): OutroSeg => brandOutro(opts);
// общие настройки всех роликов канала (музыка, 60 к/с, голос, субтитры) — brands/manacost/channel.ts
export const YT_BASE: Pick<YtConfig, 'music' | 'fps' | 'subtitles' | 'voice' | 'pronounce'> = BRAND_BASE;

// ─── Пороги проверок роликов канала — единый источник для yt-qa, release.mjs, yt-thumb.mjs ───
// общие (субтитры, SEO, темп, файл, обложки) — core/qa/limits.ts, сцены колоды и обложки — games/hearthstone/data/audit.ts,
// здесь — удержание и права. Документы называют константу и её значение отсюда: менять порог — только в источнике.
// ❌ — ошибка (ролик не готов), ⚠ — предупреждение (посмотреть), ℹ — заметка.
export const LIMITS = {
  // ── Данные ролика (yt-qa) ──
  // сцена колоды: idleSec, deckName, pointsMax, pointText, pointDetail, inkMax, vsLabel; обложка: thumbLine
  ...DECK_LIMITS,
  ...THUMB_LIMITS,

  // ── Удержание (release.mjs) ──
  hookSec: 8, // сильное начало длиннее — ⚠
  firstDeckSec: 20, // суть (первая колода) начинается позже — ⚠

  // ── Права ──
  clipAgeDays: 60, // ролик-источник врезки старше статьи на столько дней — ⚠ (сборка колоды могла измениться)

  // ── Общие: субтитры, описание и SEO, темп, файл к загрузке, обложки (core/qa/limits.ts) ──
  ...VIDEO_LIMITS,
};
