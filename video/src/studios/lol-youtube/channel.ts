// Канал «YouTube по League of Legends (канал — TODO)»: стиль gazette (src/looks/gazette — «Газета», выбран 04.10 по стиль-кадру B для
// фрагмента), бренд lol-channel (src/brands/lol-channel), игра lol (src/games/lol)
// и все виды сцен канала. Отсюда — тип конфига ролика (LolConfig = ConfigOf<typeof channel>), пороги проверок (LIMITS) и проверки
// канала (qa → core/qa/audit.ts). Регистрация композиций — ./Root.tsx. Заготовка — scripts/new-direction.mjs (2026-10-04);
// образец сборки — src/studios/manacost-youtube/channel.ts (смотреть, не импортировать).
// Новая сцена = файл сцены (компонент + defineScene): без игры — src/looks/gazette/scenes, с игрой — src/games/lol/scenes;
// + строка в scenes ниже
import {defineChannel, fields, type ConfigOf, type SegOf} from '../../core/video/registry';
import {VIDEO_LIMITS} from '../../core/qa/limits';
import {gazette} from '../../looks/gazette/look';
import {patchChampion} from '../../games/lol/scenes';
import {YT_BASE as BRAND_BASE} from '../../brands/lol-channel/channel';
import GAME_PRONOUNCE from '../../games/lol/data/pronounce.json';
import STUDIO_PRONOUNCE from './pronounce.json';

// Обложка (Root.tsx → Thumb): TODO — поля обложки направления после стиль-кадров; пока только надпись
export type LolThumbSpec = {title: string};

// Описание и поиск YouTube (yt-export, проверка — yt-qa): lead — первая строка описания, hashtags — до трёх, без «#»,
// tags — теги (→ tags.txt; слова из legal.forbiddenInVideo и legal.forbiddenInTags бренда — ❌), titles — варианты названия (→ titles.txt), playlist, pinnedComment
export type LolSeo = {lead: string; hashtags?: string[]; tags?: string[]; titles?: string[]; playlist?: string; pinnedComment?: string};

// Поля конфига канала сверх голоса (VoicedConfig, core/video/types.ts)
export type LolFields = {
  title: string; // название ролика на YouTube (слова из legal.forbiddenInVideo бренда — ❌)
  url?: string; // источник
  thumb: LolThumbSpec;
  thumbs?: Partial<LolThumbSpec>[]; // ещё до двух вариантов обложки (B, C)
  seo?: LolSeo;
};

export const channel = defineChannel({
  look: gazette,
  brand: 'lol-channel',
  game: 'lol',
  // ctx сцен (общее для сцен ролика: бренд, места, гербы…) — TODO: что сценам стиля и игры нужно от канала
  context: () => ({}),
  fields: fields<LolFields>(),
  // Сцены канала. Первая — изменения чемпиона в патче (фрагмент 04.10 на одобрение); остальные (вступление, финал, тир-лист) —
  // после «да» на фрагмент: сцена без игры — src/looks/gazette/scenes, с игрой — src/games/lol/scenes, затем строка здесь
  scenes: [patchChampion],
  // проверки канала (yt-qa): словарь игры, поверх него — словарь бренда ./pronounce.json; проверки игры (обложка, данные) — TODO
  qa: {pronounce: {...GAME_PRONOUNCE, ...STUDIO_PRONOUNCE}, pronounceFile: 'src/games/lol/data/pronounce.json'},
});

// Конфиг ролика канала: голос (VoicedConfig) + поля канала + сегменты только тех видов, что есть в scenes
export type LolConfig = ConfigOf<typeof channel>;
export type LolSegment = SegOf<typeof channel>;

// Общие настройки роликов канала (музыка, частота, субтитры, голос, словарь) — из бренда; конфиг ролика берёт их отсюда:
// import {YT_BASE, type LolConfig} from '../channel'
export const YT_BASE: Pick<LolConfig, 'music' | 'fps' | 'subtitles' | 'voice' | 'pronounce'> = BRAND_BASE;

// ─── Пороги проверок роликов канала — для yt-qa, release.mjs, yt-thumb.mjs ───
// общие (субтитры, SEO, темп, файл, обложки) — core/qa/limits.ts; свои пороги канала и игры — здесь (TODO по брифу)
export const LIMITS = {
  // ── Удержание (release.mjs) ──
  hookSec: 8, // сильное начало длиннее — ⚠
  firstDeckSec: 20, // суть ролика начинается позже — ⚠ (имя порога — от первого направления)
  idleSec: 8, // сцена без нового на экране дольше — ⚠

  // ── Права ──
  clipAgeDays: 60, // источник врезки старше ролика на столько дней — ⚠

  // ── Общие: субтитры, описание и SEO, темп, файл к загрузке, обложки (core/qa/limits.ts) ──
  ...VIDEO_LIMITS,
};
