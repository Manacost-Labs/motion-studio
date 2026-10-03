// Конфиг YouTube-ролика Манакоста. Ролик — список сегментов (сцен) любого вида в любом порядке:
// так собираются и подборки («топ колод»), и гайды на колоду (обзор → ключевые карты → муллиган → матч-апы → советы).
// Весь текст диктора — в поле vo; всё, что появляется «под голос», привязывается к фразе из vo (поле at).

export type DeckCard = {id: string; name: string; cost: number; rarity?: string; count: number};

// Карта крупно, когда диктор её называет (id — как в HearthstoneJSON). note — подпись под картой (в сцене cards);
// ink — на постере колоды карту обводит красное перо (пометка редактора: ключевая карта), пока камера на ней
export type SpokenCard = {id: string; at?: string; note?: string; ink?: boolean};
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
  mural?: string; // полупрозрачный персонаж (вырезка из public, например chars/warlock.png)
  highlight?: string[]; // слова, которые в субтитрах подсвечиваются (запас на будущее)
};

// Вступление: classes — гербы классов подборки по очереди (строка под заголовком);
// tease — картинки из public (постеры топа), которые мелькают под размытием: интрига, кто на вершине
// teaseAt — фраза, на которой появляются постеры tease (без неё — с середины речи)
export type IntroSeg = Base & {kind: 'intro'; kicker: string; title: string; sub?: string; classes?: string[]; tease?: string[]; teaseAt?: string};

// Матч-ап колоды из текста источника: против кого сильна (good) или слаба (bad). cls — класс (герб), label — подпись
// (конкретная колода, если названа), at — фраза диктора, на которой строка загорается
export type Versus = {cls: string; verdict: 'good' | 'bad'; label?: string; at?: string};

// Врезка в сцену колоды на место постера, пока звучит фраза (at … to): разбор комбо или фрагмент геймплея.
// combo: карты появляются на своих фразах, results — итоговые числа (только из текста источника!) со счётчиком.
// clip: видео из public (start — с какой секунды, crop — [x, y, w, h] в пикселях исходника), всегда с указанием автора
export type ComboInsert = {kind: 'combo'; at: string; to: string; title?: string; cards: SpokenCard[]; results: {value: number; label: string; at: string}[]};
export type ClipInsert = {kind: 'clip'; at: string; to?: string; src: string; start: number; crop?: [number, number, number, number]; credit: string; caption?: string; volume?: number};
export type DeckInsert = ComboInsert | ClipInsert;

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
  vs?: Versus[]; // блок «Матч-апы» под тезисами
  inserts?: DeckInsert[]; // врезки на месте постера
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

// recap — финал открывается итоговой таблицей всех колод с местами (собирается из сцен колод сама); на фразе to
// страница перелистывается на прощание и места под конечную заставку YouTube
export type OutroSeg = Base & {kind: 'outro'; title: string; links: {label: string; text: string}[]; recap?: {to: string; kicker?: string; title: string}};
export type RecapDeck = {rank: number; name: string; cls: string; dust?: number};

// Сильное начало (перед вступлением, 3–5 с): самый яркий факт ролика на сукне — крупное число со счётчиком (value, label;
// at — фраза, на которой число отсчитывается), веер карт (cards, каждая на своей фразе) и добивка punch — строка внизу
// (например «и это всего лишь 15-е место»), cls — герб рядом с ней
export type HookSeg = Base & {kind: 'hook'; value: number; label: string; at?: string; cards: SpokenCard[]; punch: {text: string; at: string; cls?: string}};

// Разделитель блоков (без голоса, ~2,5 с, музыка без приглушения): «Дальше» + «Топ-10» и ряд медалей мест блока
// block — места блока от и до (например [10, 6]). В главы описания не попадает — входит в следующую главу
export type DividerSeg = Base & {kind: 'divider'; kicker?: string; title: string; block: [number, number]};

export type YtSegment = HookSeg | IntroSeg | DeckSeg | CardsSeg | MulliganSeg | MatchupsSeg | PointsSeg | ImageSeg | DividerSeg | OutroSeg;

export type YtConfig = {
  id: string; // папка ролика в src/studios/manacost-youtube; голос ищется в public/vo/<id>/<сегмент>.mp3
  title: string; // название ролика на YouTube
  url?: string; // статья-источник
  music: string[]; // треки по кругу с перекрёстным затуханием
  fps?: 30 | 60; // частота кадров ролика (по умолчанию 30); тайминги шаблона — всегда в «кадрах-30» (fps.ts)
  subtitles?: 'auto' | 'on' | 'off'; // auto — только там, где ещё нет записи голоса
  // обложка: cards — 3 карты веером справа (последняя — передняя); hook — надпись на сургучной печати поверх веера
  thumb: {title: string; badge: string; cards: string[]; hook?: string};
  // Озвучка ElevenLabs (scripts/tts.mjs). id — voice_id диктора (иначе ELEVENLABS_VOICE_ID из .env);
  // speed 0.7–1.2, stability/similarity/style 0–1; seed — чтобы перезапись давала тот же дубль
  // fx — обработка голоса (scripts/vo-fx.mjs): broadcast (по умолчанию), warm или off
  // tempo — темп записи без изменения высоты (1.06 — на 6 % быстрее; применяет vo-align.mjs при нарезке)
  voice?: {id?: string; speed?: number; stability?: number; similarity?: number; style?: number; seed?: number; fx?: 'broadcast' | 'warm' | 'off'; tempo?: number};
  // Как диктору читать слово: {'ОТК': 'о-тэ-кА'}. На экране и в субтитрах остаётся написание из vo.
  // В vo можно ставить аудиотеги v4 — [pause], [warmly], [curious] — диктор их исполнит, на экран они не попадут.
  // [excited] не ставить: Alex Bell с ним кричит
  pronounce?: Record<string, string>;
  segments: YtSegment[];
};

// ─── Рассчитывается в calculateMetadata (YtVideo.tsx) ───
export type Sub = {from: number; to: number; text: string}; // кадры внутри сегмента
// times — время (с от начала записи) начала и конца каждого символа текста на экране; есть, когда голос записан
export type SegTiming = {
  id: string;
  from: number;
  dur: number;
  voFrom: number;
  voDur: number;
  voice: string | null;
  subs: Sub[];
  times?: {start: number[]; end: number[]};
};
export type MusicCue = {src: string; from: number; dur: number};
// всё в «кадрах-30»; base — их частота (для перевода в секунды)
export type YtTiming = {segments: SegTiming[]; music: MusicCue[]; total: number; base?: number};
export type YtProps = {config: YtConfig; timing?: YtTiming};
