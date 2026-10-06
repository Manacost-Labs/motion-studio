// Адаптер статьи-подборки колод (article.json пишет scripts/fetch-article.mjs, постеры — scripts/deck-posters.mjs):
// колода по месту, гербы классов для вступления, постеры топа под размытием, разделители блоков «Топ-N».
// Возвращает данные сцен без типов шаблона: тип сцены (DeckSeg, DividerSeg) задаёт канал студии (studios/manacost-youtube/channel.ts)
import type {DeckCard, DeckPosterData} from './types';

// Колода из article.json: место, название, класс, режим, герой, код, 30 карт и постер
export type ArticleDeck = {name: string; cls: string; mode: string; hero: string; code: string; list: DeckCard[]; poster?: DeckPosterData; rank: number; heroClass: string};
export type ArticleData = {url: string; title: string; decks: ArticleDeck[]};

// Сцена колоды: данные из статьи + текст автора. id сцены — deck-<место двумя цифрами> (deck-01 … deck-15):
// под этим именем лежит голос public/vo/<id ролика>/deck-07.mp3
export const articleDeck = <T extends {vo: string}>(article: ArticleData, rank: number, text: T) => {
  const d = article.decks.find((x) => x.rank === rank);
  if (!d) throw new Error(`В article.json нет колоды №${rank}`);
  return {kind: 'deck' as const, id: `deck-${String(rank).padStart(2, '0')}`, rank, name: d.name, cls: d.cls, mode: d.mode, hero: d.hero, code: d.code, list: d.list, poster: d.poster, ...text};
};

// Гербы классов подборки с последнего места к первому — строка во вступлении
export const articleClasses = (article: ArticleData) => [...article.decks].sort((a, b) => b.rank - a.rank).map((d) => d.heroClass);

// Постеры топ-3 под размытием во вступлении («кто на вершине — узнаем в конце»)
export const articleTease = (article: ArticleData) =>
  [3, 2, 1].flatMap((r) => {
    const p = article.decks.find((d) => d.rank === r)?.poster;
    return p ? [p.src] : [];
  });

// Разделитель блоков: divider(10, 6) — «Топ-10», медали 10…6. Ставится в segments прямо перед колодой №from
export const divider = (from: number, to: number, title = `Топ-${from}`) => ({kind: 'divider' as const, id: `div-${from}`, vo: '', title, block: [from, to] as [number, number]});

// Где ставить разделители при N колодах: перед 10 и 5 (15 колод → три блока по пять), при 8–11 — только перед 5
export const dividerRanks = (n: number) => [10, 5].filter((r) => r < n - 2);
