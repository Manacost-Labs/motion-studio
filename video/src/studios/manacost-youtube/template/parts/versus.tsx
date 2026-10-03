// Нижний левый угол сцены колоды: блок «Матч-апы» (герб класса, подпись, сильнее/слабее — загорается под голос)
// и карточка карты, которую диктор назвал, но которой нет в колоде (камера её пропускает — показываем здесь)
import React from 'react';
import {Img, interpolate} from 'remotion';
import {DISPLAY} from '../../brand';
import {H, ramp, TEXT} from '../theme';
import {Versus} from '../types';
import {crestFor, hsRender} from './stage';
import {useFrame} from '../fps';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type VersusItem = Versus & {t: number}; // t — кадр, на котором строка загорается

// Две колонки плашек; dim(f) — насколько приглушить блок (пока показана карточка «не в колоде»).
// pre — кадр, с которого блок виден заранее, приглушённым (как тезисы): соперники уже на странице, а на своей фразе
// плашка загорается и получает вердикт «сильнее/слабее». Без pre блок появляется к первой фразе.
// bottom — прижать блок к низу (отступ снизу) вместо y; без x — блок в потоке (внутри общего низа колонки)
export const VersusBlock: React.FC<{items: VersusItem[]; x?: number; y?: number; bottom?: number; w: number; pre?: number; dim?: (f: number) => number}> = ({items, x, y, bottom, w, pre, dim}) => {
  const f = useFrame();
  if (!items.length) return null;
  const first = Math.min(...items.map((i) => i.t));
  const start = pre ?? first - 10;
  const lp = ramp(f, start, start + 18);
  const colW = (w - 24) / 2;
  return (
    <div style={{position: x === undefined ? 'relative' : 'absolute', left: x, top: y, bottom, width: w, opacity: dim ? dim(f) : 1}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, opacity: lp}}>
        <div style={{width: 10, height: 10, rotate: '45deg', background: H.red}} />
        <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 19, letterSpacing: '0.16em', color: H.inkMuted, textTransform: 'uppercase'}}>Матч-апы</span>
        <div style={{flex: 1, height: 2, background: `linear-gradient(90deg, ${H.ink}55, transparent)`, scale: `${lp} 1`, transformOrigin: 'left'}} />
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: '14px 24px'}}>
        {items.map((it, i) => {
          const p = ramp(f, it.t, it.t + 16);
          const shown = pre === undefined ? p : ramp(f, pre + 8 + i * 4, pre + 24 + i * 4);
          const lit = pre === undefined ? 1 : 0.42 + 0.58 * p;
          const good = it.verdict === 'good';
          return (
            <div key={i} style={{width: colW, display: 'flex', alignItems: 'center', gap: 16, opacity: shown * lit, translate: `${(1 - shown) * -14 + p * (1 - ramp(f, it.t + 16, it.t + 40)) * 6}px 0`}}>
              <Img src={crestFor(it.cls)} style={{width: 62, height: 62, flexShrink: 0, filter: 'drop-shadow(0 3px 5px rgba(60,25,10,0.3))'}} />
              <div style={{minWidth: 0}}>
                <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 27, lineHeight: 1.1, color: H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {it.label ?? it.cls}
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontFamily: TEXT, fontWeight: 800, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase', color: good ? H.positive : H.negative, opacity: p, translate: `${(1 - p) * -8}px 0`}}>
                  <span style={{fontFamily: DISPLAY, fontSize: 21, letterSpacing: 0, lineHeight: 1}}>{good ? '▲' : '▼'}</span>
                  {good ? 'сильнее' : 'слабее'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const OFF_DECK_HOLD = 120; // сколько кадров держится карточка «не в колоде»

// Прозрачность блока матч-апов, пока показана карточка (0.12 — почти убран)
export const offDeckDim = (times: number[]) => (f: number) =>
  Math.min(1, ...times.map((t) => interpolate(f, [t - 10, t, t + OFF_DECK_HOLD, t + OFF_DECK_HOLD + 12], [1, 0.12, 0.12, 1], clamp)));

export const OffDeckCard: React.FC<{id: string; at: number; x: number; y?: number; bottom?: number; h: number}> = ({id, at, x, y, bottom, h}) => {
  const f = useFrame();
  const p = interpolate(f, [at, at + 14, at + OFF_DECK_HOLD, at + OFF_DECK_HOLD + 12], [0, 1, 1, 0], clamp);
  if (p <= 0.001) return null;
  const e = ramp(f, at, at + 18);
  return (
    <div style={{position: 'absolute', left: x, top: y, bottom, display: 'flex', alignItems: 'center', gap: 22, opacity: p}}>
      <Img src={hsRender(id)} style={{height: h, translate: `0 ${(1 - e) * 24}px`, filter: 'drop-shadow(0 14px 18px rgba(60,25,10,0.4))'}} />
      <div style={{translate: `${(1 - e) * -10}px 0`}}>
        <div style={{fontFamily: TEXT, fontWeight: 800, fontSize: 17, letterSpacing: '0.14em', textTransform: 'uppercase', color: H.red}}>Упомянута</div>
        <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 25, lineHeight: 1.25, color: H.inkMuted, marginTop: 6, maxWidth: 300}}>в разборе, но в этой сборке её нет</div>
      </div>
    </div>
  );
};
