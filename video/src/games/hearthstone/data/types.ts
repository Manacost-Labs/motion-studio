// Данные Hearthstone в конфигах роликов: карты, постеры колод, матч-апы, муллиган, врезки в сцену колоды.
// Сцены (DeckSeg, CardsSeg, …) собираются из этих типов в сценах игры (games/hearthstone/scenes/types.ts).

export type DeckCard = {id: string; name: string; cost: number; rarity?: string; count: number};

// Карта крупно, когда диктор её называет (id — как в HearthstoneJSON). note — подпись под картой (в сцене cards);
// ink — на постере колоды карту обводит красное перо (пометка редактора: ключевая карта), пока камера на ней
export type SpokenCard = {id: string; at?: string; note?: string; ink?: boolean};

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

// Матч-ап колоды из текста источника: против кого сильна (good) или слаба (bad). cls — класс (герб), label — подпись
// (конкретная колода, если названа), at — фраза диктора, на которой строка загорается
export type Versus = {cls: string; verdict: 'good' | 'bad'; label?: string; at?: string};

// Врезка в сцену колоды на место постера, пока звучит фраза (at … to): разбор комбо или фрагмент геймплея.
// combo: карты появляются на своих фразах, results — итоговые числа (только из текста источника!) со счётчиком.
// clip: видео из public (start — с какой секунды, crop — [x, y, w, h] в пикселях исходника), всегда с указанием автора;
// рядом с видео — паспорт <клип>.json (scripts/eyes.mjs cut, rec.mjs take): источник, автор, лицензия, дата — без него yt-qa ❌.
// probe — пробная врезка (чужой геймплей «для примера», не та колода): по данным ⚠, по видео и в release.mjs ❌ — для выпуска заменить
export type ComboInsert = {kind: 'combo'; at: string; to: string; title?: string; cards: SpokenCard[]; results: {value: number; label: string; at: string}[]};
export type ClipInsert = {kind: 'clip'; at: string; to?: string; src: string; start: number; crop?: [number, number, number, number]; credit: string; caption?: string; volume?: number; probe?: boolean};
export type DeckInsert = ComboInsert | ClipInsert;

// Муллиган: группа карт «оставлять / по ситуации / менять»
export type MulliganGroup = {label: string; tone: 'keep' | 'maybe' | 'toss'; cards: string[]; at?: string};

// Матч-ап в таблице: value — процент побед (только реальные цифры!), без него — вердикт
export type MatchupRow = {name: string; cls: string; verdict: 'good' | 'even' | 'bad'; value?: number; note?: string; at?: string};

// Строка итоговой таблицы финала: место, колода, класс, стоимость в пыли
export type RecapDeck = {rank: number; name: string; cls: string; dust?: number};
