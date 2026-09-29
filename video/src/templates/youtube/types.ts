// Конфиг YouTube-ролика Манакоста. Ролик — список сегментов (сцен) любого вида в любом порядке:
// так собираются и подборки («топ колод»), и гайды на колоду (обзор → ключевые карты → муллиган → матч-апы → советы).
// Весь текст диктора — в поле vo; всё, что появляется «под голос», привязывается к фразе из vo (поле at).

export type DeckCard = {id: string; name: string; cost: number; rarity?: string; count: number};

// Карта крупно, когда диктор её называет (id — как в HearthstoneJSON). note — подпись под картой (в сцене cards)
export type SpokenCard = {id: string; at?: string; note?: string};
// Тезис на экране: заголовок (text) и пояснение (detail). Без at — тезисы распределяются по тексту равномерно
export type Point = {text: string; detail?: string; at?: string};

// Постер колоды из api.blizzcore.ru (scripts/deck-posters.mjs): картинка, размер, порядок карт на постере, стоимость в пыли
// rects — точные [x, y, w, h] рендера каждой карты на постере (scripts/poster-fit.mjs); без них — по сетке из poster.ts
export type DeckPosterData = {
  src: string;
  w: number;
  h: number;
  order: string[];
  types?: string[];
  rarities?: (string | null)[];
  rects?: number[][];
  dust?: number;
};

type Base = {
  id: string;
  vo: string;
  chapter?: string; // название главы в описании YouTube (по умолчанию — заголовок сцены)
  bg?: string; // id карты, чей арт на фоне
  mural?: string; // полупрозрачный персонаж (вырезка из public, например chars/warlock.png)
  highlight?: string[]; // слова, которые в субтитрах подсвечиваются (запас на будущее)
};

// Вступление: classes — гербы классов подборки по очереди (строка под заголовком)
export type IntroSeg = Base & {kind: 'intro'; kicker: string; title: string; sub?: string; arts: string[]; classes?: string[]};

// Колода: в подборке — с местом (rank), в гайде — без него. curve — кривая маны над списком
export type DeckSeg = Base & {
  kind: 'deck';
  rank?: number;
  name: string;
  cls: string;
  mode: string;
  hero: string;
  code: string;
  list: DeckCard[];
  poster?: DeckPosterData; // есть — колода показывается постером с камерой; нет — списком
  cards?: SpokenCard[];
  points?: Point[];
  curve?: boolean;
};

// Ключевые карты / комбо: ряд из 1–4 крупных карт с подписями, появляются под голос
export type CardsSeg = Base & {kind: 'cards'; kicker?: string; title: string; cards: SpokenCard[]; points?: Point[]};

// Муллиган: группы карт «оставлять / по ситуации / менять»
export type MulliganGroup = {label: string; tone: 'keep' | 'maybe' | 'toss'; cards: string[]; at?: string};
export type MulliganSeg = Base & {kind: 'mulligan'; kicker?: string; title: string; groups: MulliganGroup[]; points?: Point[]};

// Матч-апы: против кого хорошо и плохо. value — процент побед (только реальные цифры!), без него — вердикт
export type MatchupRow = {name: string; cls: string; verdict: 'good' | 'even' | 'bad'; value?: number; note?: string; at?: string};
export type MatchupsSeg = Base & {kind: 'matchups'; kicker?: string; title: string; rows: MatchupRow[]};

// Тезисы (советы, план на игру) и картинка справа: карта, герой или изображение из public
export type PointsSeg = Base & {
  kind: 'points';
  kicker?: string;
  title: string;
  points: Point[];
  side?: {card: string} | {hero: string} | {image: string};
};

// Скриншот (сайт, Reddit, игра): кадр с медленным наездом, подпись и автор
export type ImageSeg = Base & {kind: 'image'; kicker?: string; title?: string; src: string; caption?: string; credit?: string; focus?: string};

export type OutroSeg = Base & {kind: 'outro'; title: string; links: {label: string; text: string}[]; arts: string[]};

export type YtSegment = IntroSeg | DeckSeg | CardsSeg | MulliganSeg | MatchupsSeg | PointsSeg | ImageSeg | OutroSeg;

export type YtConfig = {
  id: string; // папка ролика в src/ads; голос ищется в public/vo/<id>/<сегмент>.mp3
  title: string; // название ролика на YouTube
  url?: string; // статья-источник
  music: string[]; // треки по кругу с перекрёстным затуханием
  subtitles?: 'auto' | 'on' | 'off'; // auto — только там, где ещё нет записи голоса
  thumb: {title: string; badge: string; arts: string[]; cards: string[]}; // cards — 3 карты веером справа
  // Озвучка ElevenLabs (scripts/tts.mjs). id — voice_id диктора (иначе ELEVENLABS_VOICE_ID из .env);
  // speed 0.7–1.2, stability/similarity/style 0–1; seed — чтобы перезапись давала тот же дубль
  voice?: {id?: string; speed?: number; stability?: number; similarity?: number; style?: number; seed?: number};
  // Как диктору читать слово: {'ОТК': 'о-тэ-кА'}. На экране и в субтитрах остаётся написание из vo.
  // В vo можно ставить аудиотеги v4 — [pause], [excited] — диктор их исполнит, на экран они не попадут
  pronounce?: Record<string, string>;
  segments: YtSegment[];
};

// ─── Рассчитывается в calculateMetadata (YtVideo.tsx) ───
export type Sub = {from: number; to: number; text: string}; // кадры внутри сегмента
export type SegTiming = {id: string; from: number; dur: number; voFrom: number; voDur: number; voice: string | null; subs: Sub[]};
export type MusicCue = {src: string; from: number; dur: number};
export type YtTiming = {segments: SegTiming[]; music: MusicCue[]; total: number};
export type YtProps = {config: YtConfig; timing?: YtTiming};
