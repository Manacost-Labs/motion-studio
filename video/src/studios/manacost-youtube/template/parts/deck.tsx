// Список колоды, когда постера нет: строки как в hsreplay-deck-view (компонент сайта HS-Arena) —
// блок стоимости в цвете редкости, тёмная строка с артом и переходом под 65°, золотое количество; в деревянной раме
import React from 'react';
import {Img, useCurrentFrame} from 'remotion';
import {DISPLAY} from '../../brand';
import {H, ramp, TEXT, timber} from '../theme';
import {DeckCard} from '../types';
import {hsTile} from './stage';

const RARITY: Record<string, string> = {FREE: '#858585', COMMON: '#858585', RARE: '#315376', EPIC: '#644c82', LEGENDARY: '#866027'};
const outline = (s: number) => `-${s}px -${s}px 0 #000, ${s}px -${s}px 0 #000, -${s}px ${s}px 0 #000, ${s}px ${s}px 0 #000, 0 ${s * 1.5}px 0 #000`;

const Row: React.FC<{c: DeckCard; h: number; enter: number; lit?: number[]}> = ({c, h, enter, lit}) => {
  const f = useCurrentFrame();
  const p = ramp(f, enter, enter + 12);
  const last = lit?.filter((x) => x <= f).pop();
  const k = last === undefined ? 0 : ramp(f, last, last + 8) * (1 - 0.8 * ramp(f, last + 90, last + 110));
  const s = h / 62;
  const legendary = c.rarity === 'LEGENDARY';
  const withCount = c.count > 1 || legendary;
  return (
    <div style={{display: 'flex', height: h, color: '#fff', textShadow: outline(Math.max(1, 1.6 * s)), fontFamily: TEXT, opacity: p, translate: `${(1 - p) * 24}px 0`, scale: 1 + 0.03 * k}}>
      <div style={{flex: `0 0 ${h}px`, position: 'relative', background: RARITY[c.rarity ?? 'COMMON'] ?? RARITY.COMMON, border: '1px solid #000', borderRightWidth: 0}}>
        <span style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 33 * s, fontWeight: 900, lineHeight: 1}}>{c.cost}</span>
      </div>
      <div style={{flex: '1 1 auto', minWidth: 0, position: 'relative', overflow: 'hidden', background: '#313131', border: '1px solid #000'}}>
        <Img src={hsTile(c.id)} style={{position: 'absolute', right: withCount ? 40 * s : 0, top: 0, height: '100%', width: 'auto'}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(65deg, rgb(49 49 9) 0%, rgb(49 49 49) calc(100% - ${(withCount ? 216 : 190) * s}px), rgb(49 49 49 / 0%) calc(100% - ${(withCount ? 90 : 68) * s}px), rgb(49 49 49 / 0%) 100%)`,
          }}
        />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(239,201,111,0.35), transparent 75%)', opacity: k}} />
        <span
          style={{
            position: 'absolute',
            left: 10 * s,
            top: '50%',
            translate: '0 -50%',
            width: `calc(100% - ${10 * s + (withCount ? 44 * s : 0) + 8}px)`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 22.7 * s,
            fontWeight: 900,
            lineHeight: 1.1,
          }}
        >
          {c.name}
        </span>
        {withCount && (
          <div style={{position: 'absolute', top: 0, right: 0, width: 44 * s, height: '100%', background: '#313131', borderLeft: '1px solid #000', display: 'grid', placeItems: 'center'}}>
            <span style={{color: '#f7db48', fontSize: (legendary ? 34 : 30) * s, fontWeight: 900, lineHeight: 1}}>{legendary ? '★' : c.count}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const DeckList: React.FC<{list: DeckCard[]; x: number; y: number; w: number; h: number; at: number; lit: Record<string, number[]>}> = ({list, x, y, w, h, at, lit}) => {
  const f = useCurrentFrame();
  const rowH = Math.min(40, (h - 90) / list.length - 1);
  const total = list.reduce((s, c) => s + c.count, 0);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, ...timber(18, true), backgroundColor: '#24150d', backgroundClip: 'padding-box', padding: '12px 12px 12px', opacity: ramp(f, at - 6, at + 10)}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 4px 10px', fontFamily: DISPLAY, fontSize: 28, color: H.cream}}>
        <span>Список колоды</span>
        <span style={{fontFamily: TEXT, fontWeight: 700, fontSize: 17, color: H.gold, letterSpacing: '0.08em'}}>{total} КАРТ</span>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 1}}>
        {list.map((c, i) => (
          <Row key={c.id} c={c} h={rowH} enter={at + i} lit={lit[c.id]} />
        ))}
      </div>
    </div>
  );
};
