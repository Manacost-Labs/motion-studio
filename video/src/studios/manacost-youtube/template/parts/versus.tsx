// Нижний левый угол сцены колоды: блок «Матч-апы» (герб класса, подпись, сильнее/слабее — загорается под голос)
// и карточка карты, которую диктор назвал, но которой нет в колоде (камера её пропускает — показываем здесь)
import React from 'react';
import {Img, interpolate, useCurrentFrame} from 'remotion';
import {DISPLAY} from '../../brand';
import {H, ramp, TEXT} from '../theme';
import {Versus} from '../types';
import {crestFor, hsRender} from './stage';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type VersusItem = Versus & {t: number}; // t — кадр, на котором строка загорается

// Две колонки плашек; dim(f) — насколько приглушить блок (пока показана карточка «не в колоде»)
export const VersusBlock: React.FC<{items: VersusItem[]; x: number; y: number; w: number; dim?: (f: number) => number}> = ({items, x, y, w, dim}) => {
  const f = useCurrentFrame();
  if (!items.length) return null;
  const first = Math.min(...items.map((i) => i.t));
  const lp = ramp(f, first - 10, first + 8);
  const colW = (w - 24) / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: dim ? dim(f) : 1}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, opacity: lp}}>
        <div style={{width: 10, height: 10, rotate: '45deg', background: H.red}} />
        <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 19, letterSpacing: '0.16em', color: H.inkMuted, textTransform: 'uppercase'}}>Матч-апы</span>
        <div style={{flex: 1, height: 2, background: `linear-gradient(90deg, ${H.ink}55, transparent)`, scale: `${lp} 1`, transformOrigin: 'left'}} />
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px 24px'}}>
        {items.map((it, i) => {
          const p = ramp(f, it.t, it.t + 16);
          const good = it.verdict === 'good';
          return (
            <div key={i} style={{width: colW, display: 'flex', alignItems: 'center', gap: 14, opacity: p, translate: `${(1 - p) * -14}px 0`}}>
              <Img src={crestFor(it.cls)} style={{width: 54, height: 54, flexShrink: 0, filter: 'drop-shadow(0 3px 5px rgba(60,25,10,0.3))'}} />
              <div style={{minWidth: 0}}>
                <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 25, lineHeight: 1.1, color: H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {it.label ?? it.cls}
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, fontFamily: TEXT, fontWeight: 800, fontSize: 15, letterSpacing: '0.12em', textTransform: 'uppercase', color: good ? H.positive : H.negative}}>
                  <span style={{fontFamily: DISPLAY, fontSize: 20, letterSpacing: 0, lineHeight: 1}}>{good ? '▲' : '▼'}</span>
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

export const OffDeckCard: React.FC<{id: string; at: number; x: number; y: number; h: number}> = ({id, at, x, y, h}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 14, at + OFF_DECK_HOLD, at + OFF_DECK_HOLD + 12], [0, 1, 1, 0], clamp);
  if (p <= 0.001) return null;
  const e = ramp(f, at, at + 18);
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 22, opacity: p}}>
      <Img src={hsRender(id)} style={{height: h, translate: `0 ${(1 - e) * 24}px`, filter: 'drop-shadow(0 14px 18px rgba(60,25,10,0.4))'}} />
      <div style={{translate: `${(1 - e) * -10}px 0`}}>
        <div style={{fontFamily: TEXT, fontWeight: 800, fontSize: 17, letterSpacing: '0.14em', textTransform: 'uppercase', color: H.red}}>Упомянута</div>
        <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 25, lineHeight: 1.25, color: H.inkMuted, marginTop: 6, maxWidth: 300}}>в разборе, но в этой сборке её нет</div>
      </div>
    </div>
  );
};
