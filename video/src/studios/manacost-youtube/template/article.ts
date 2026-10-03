// Ролик по статье hs-manacost.ru: всё одинаковое для каждого ролика — здесь, в конфиге ролика остаётся только текст.
// article.json пишет scripts/fetch-article.mjs (+ постеры scripts/deck-posters.mjs); заготовку конфига — scripts/yt-new.mjs.
//
//   import {articleDeck, articleClasses, articleTease, divider, manacostOutro, YT_BASE} from '../template/article';
//   import article from './article.json';
//   const deck = (rank: number, text: DeckText) => articleDeck(article, rank, text);
//   segments: [hook, intro, deck(15, {...}), …, divider(10, 6), deck(10, {...}), …, manacostOutro()]
import {DeckSeg, DividerSeg, OutroSeg, YtConfig} from './types';

// Колода из article.json: место, название, класс, режим, герой, код, 30 карт и постер
export type ArticleDeck = Pick<DeckSeg, 'name' | 'cls' | 'mode' | 'hero' | 'code' | 'list' | 'poster'> & {rank: number; heroClass: string};
export type ArticleData = {url: string; title: string; decks: ArticleDeck[]};

// Что пишет автор ролика для каждой колоды. Обязательно только vo — текст диктора
export type DeckText = Pick<DeckSeg, 'vo'> & Partial<Pick<DeckSeg, 'mural' | 'chapter' | 'cards' | 'points' | 'vs' | 'inserts'>>;

// Сцена колоды: данные из статьи + текст автора. id сцены — deck-<место двумя цифрами> (deck-01 … deck-15):
// под этим именем лежит голос public/vo/<id ролика>/deck-07.mp3
export const articleDeck = (article: ArticleData, rank: number, text: DeckText): DeckSeg => {
  const d = article.decks.find((x) => x.rank === rank);
  if (!d) throw new Error(`В article.json нет колоды №${rank}`);
  return {kind: 'deck', id: `deck-${String(rank).padStart(2, '0')}`, rank, name: d.name, cls: d.cls, mode: d.mode, hero: d.hero, code: d.code, list: d.list, poster: d.poster, ...text};
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
export const divider = (from: number, to: number, title = `Топ-${from}`): DividerSeg => ({kind: 'divider', id: `div-${from}`, vo: '', title, block: [from, to]});

// Где ставить разделители при N колодах: перед 10 и 5 (15 колод → три блока по пять), при 8–11 — только перед 5
export const dividerRanks = (n: number) => [10, 5].filter((r) => r < n - 2);

// Финал Манакоста: итоговая таблица всех колод под первую фразу, на «Подписывайтесь» — конечная заставка YouTube
export const manacostOutro = (opts: {kicker: string; title?: string; vo?: string}): OutroSeg => ({
  kind: 'outro',
  id: 'outro',
  title: 'Удачных игр\nв ладдере!',
  recap: {to: 'Подписывайтесь', kicker: opts.kicker, title: opts.title ?? 'Все колоды подборки'},
  links: [
    {text: 'hs-manacost.ru', label: 'полная статья'},
    {text: 't.me/manacost_ru', label: 'новости в Telegram'},
    {text: 'vk.com/manacost', label: 'группа ВКонтакте'},
  ],
  vo:
    opts.vo ??
    'Вот и вся подборка. Коды всех колод — в описании под видео, а полная статья — на нашем сайте. ' +
      'Подписывайтесь на канал и на наш Телеграм, чтобы не пропускать новые подборки. Удачных игр в ладдере!',
});

// Общие настройки всех роликов: музыка-подложка (*-bed.m4a — треки, выровненные под голос: мягкая компрессия, −16 LUFS), 60 к/с, голос Alex Bell (+6 % темпа), без субтитров в кадре
// (только .srt), как читать частые сокращения. В конфиге: {...YT_BASE, id, title, …, pronounce: {...YT_BASE.pronounce, …}}
export const YT_BASE: Pick<YtConfig, 'music' | 'fps' | 'subtitles' | 'voice' | 'pronounce'> = {
  music: ['lib/music/tavern-30-bed.m4a', 'lib/music/mystic-30-bed.m4a'],
  fps: 60,
  subtitles: 'auto',
  voice: {id: 'TUQNWEvVPBLzMBSVDPUA', tempo: 1.06},
  pronounce: {ОТК: 'о-тэ-ка', ДК: 'дэ-ка', ДХ: 'дэ-ха'},
};
