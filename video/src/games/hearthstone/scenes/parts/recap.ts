// Ячейка итоговой таблицы финала (looks/compendium → RecapBoard) для колоды: герб класса, название, «класс · пыль».
// Канал отдаёт строки стилю через ctx (studios/<студия>/channel.ts → context)
import type {RecapRow} from '../../../../looks/compendium/parts/recap';
import type {RecapDeck} from '../../data/types';
import {crestFor} from './crest';

// узкого неразрывного пробела из toLocaleString нет в Belwe — ставим обычный
export const recapRow = (d: RecapDeck): RecapRow => ({
  rank: d.rank,
  name: d.name,
  icon: crestFor(d.cls),
  sub: d.dust !== undefined ? `${d.cls} · ${d.dust.toLocaleString('ru-RU').replace(/\s/g, ' ')} пыли` : d.cls,
});
