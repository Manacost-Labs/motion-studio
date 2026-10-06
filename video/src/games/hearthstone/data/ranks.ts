// Места топа в подборке колод — общее для сцен ролика (хук игры для channel.context, core/video/registry.ts):
// ranks — место каждого сегмента (у колоды с rank, иначе undefined: шапка следующей сцены прокручивает номер с него),
// rankOf — «из скольких» (наибольшее место, если колод с местом больше одной), decks — итоговая таблица финала
import type {BaseSeg} from '../../../core/video/types';
import type {RecapDeck} from './types';

// Места топ-3 открываются заставкой места: пауза до голоса дольше, пока идёт заставка (сцена колоды → RankReveal)
export const TOP_REVEAL = 3;

// Форма сегмента колоды, которую читает хук (весь DeckSeg — в шаблоне студии)
type DeckLike = BaseSeg & {kind: 'deck'; rank?: number; name: string; cls: string; poster?: {dust?: number}};
const isDeck = (s: BaseSeg): s is DeckLike => s.kind === 'deck';

export type HsContext = {ranks: (number | undefined)[]; rankOf?: number; decks: RecapDeck[]};

export const hsContext = (segs: readonly BaseSeg[]): HsContext => {
  const ranks = segs.map((s) => (isDeck(s) ? s.rank : undefined));
  const placed = ranks.filter((r): r is number => r !== undefined);
  const rankOf = placed.length > 1 ? Math.max(...placed) : undefined;
  const decks = segs.flatMap((s) => (isDeck(s) && s.rank !== undefined ? [{rank: s.rank, name: s.name, cls: s.cls, dust: s.poster?.dust}] : []));
  return {ranks, rankOf, decks};
};
