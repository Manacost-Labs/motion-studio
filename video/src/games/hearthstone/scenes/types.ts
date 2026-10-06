// Сегменты сцен Hearthstone (стиль «Компендиум»): колода, ключевые карты, муллиган, матч-апы, сильное начало и
// тезисы со стороной игры (карта или герой). Общее у сцен (Base) — от стиля, данные карт и колод — games/hearthstone/data
import type {Point} from '../../../core/video/types';
import type {Base, PointsSeg as LookPointsSeg} from '../../../looks/compendium/types';
import type {DeckCard, DeckInsert, DeckPosterData, MatchupRow, MulliganGroup, SpokenCard, Versus} from '../data/types';

// Сторона сцены тезисов: карта (id) или портрет героя (id арта)
export type HsSide = {card: string} | {hero: string};
// Тезисы (советы, план на игру) и картинка справа: карта, герой или изображение из public
export type PointsSeg = LookPointsSeg<HsSide>;

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
export type MulliganSeg = Base & {kind: 'mulligan'; kicker?: string; title: string; groups: MulliganGroup[]; points?: Point[]};

// Матч-апы: против кого хорошо и плохо (MatchupRow: value — процент побед, только реальные цифры!)
export type MatchupsSeg = Base & {kind: 'matchups'; kicker?: string; title: string; rows: MatchupRow[]};

// Сильное начало (перед вступлением, 3–5 с): самый яркий факт ролика на сукне — крупное число со счётчиком (value, label;
// at — фраза, на которой число отсчитывается), веер карт (cards, каждая на своей фразе) и добивка punch — строка внизу
// (например «и это всего лишь 15-е место»), cls — герб рядом с ней
export type HookSeg = Base & {kind: 'hook'; value: number; label: string; at?: string; cards: SpokenCard[]; punch: {text: string; at: string; cls?: string}};
