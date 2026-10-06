// Итоговая таблица подборки: все строки по местам — три колонки по пять строк (1–5, 6–10, 11–15), номер красными
// чернилами, значок (герб), название и подпись. Строки проявляются обратным отсчётом, с последнего места
// к первому; №1 — в золотой раме с пометкой лидера (leaderLabel канала). Пока таблица в кадре, она медленно наезжает.
// Что в строке, решает игра (у Hearthstone — колода: герб класса и «класс · пыль», games/hearthstone/scenes/parts/recap.ts)
import React from 'react';
import {Img} from 'remotion';
import {DISPLAY, goldFrame, H, ramp, TEXT} from '../theme';
import {useFrame} from '../../../core/time/fps';

// Строка итоговой таблицы: место, значок (картинка), название и подпись под ним
export type RecapRow = {rank: number; name: string; icon?: string; sub: string};

const AREA = {x: 64, y: 196, w: 1792, h: 836};
const ROWS = 5;
const GAP = 48;
const STEP = 4; // кадров между строками

// to — кадр, когда таблица уходит (до него идёт медленный наезд); leaderLabel — пометка над №1
export const RecapBoard: React.FC<{rows: RecapRow[]; to: number; at?: number; leaderLabel?: string}> = ({rows, to, at = 8, leaderLabel}) => {
  const f = useFrame();
  const list = [...rows].sort((a, b) => a.rank - b.rank);
  const cols = Math.ceil(list.length / ROWS);
  const cw = (AREA.w - GAP * (cols - 1)) / cols;
  const rh = AREA.h / ROWS;
  const push = 1 + 0.025 * ramp(f, 0, to, (x) => x);
  return (
    <div style={{position: 'absolute', left: AREA.x, top: AREA.y, width: AREA.w, height: AREA.h, scale: push, transformOrigin: '50% 40%'}}>
      {list.map((d, i) => {
        const col = Math.floor(i / ROWS);
        const row = i % ROWS;
        const a = at + (list.length - 1 - i) * STEP; // обратный отсчёт: последнее место первым
        const p = ramp(f, a, a + 16);
        const lead = d.rank === 1;
        const lp = lead ? ramp(f, a + 8, a + 30) : 0;
        return (
          <div
            key={d.rank}
            style={{
              position: 'absolute',
              left: col * (cw + GAP),
              top: row * rh,
              width: cw,
              height: rh,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '0 18px 0 6px',
              boxSizing: 'border-box',
              opacity: p,
              translate: `0 ${(1 - p) * 18}px`,
            }}
          >
            {lead && <div style={{position: 'absolute', inset: '8px -10px', ...goldFrame(7), background: 'rgba(239,201,111,0.16)', opacity: lp}} />}
            {row < ROWS - 1 && i < list.length - 1 && !lead && (
              <div style={{position: 'absolute', left: 0, bottom: 0, width: cw * ramp(f, a + 4, a + 22), height: 1.5, background: `${H.ink}22`}} />
            )}
            <span style={{position: 'relative', fontFamily: DISPLAY, fontSize: 70, lineHeight: 1, color: H.red, width: 92, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{d.rank}</span>
            {d.icon && <Img src={d.icon} style={{position: 'relative', width: 76, height: 76, flexShrink: 0, filter: 'drop-shadow(0 4px 6px rgba(60,25,10,0.35))'}} />}
            <div style={{position: 'relative', minWidth: 0}}>
              {lead && leaderLabel && (
                <div style={{fontFamily: TEXT, fontWeight: 800, fontSize: 16, letterSpacing: '0.18em', color: H.red, textTransform: 'uppercase', marginBottom: 4, opacity: lp}}>{leaderLabel}</div>
              )}
              <div style={{fontFamily: DISPLAY, fontSize: 33, lineHeight: 1.06, color: H.ink, textWrap: 'balance'}}>{d.name}</div>
              <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 21, color: H.inkMuted, marginTop: 6, whiteSpace: 'nowrap'}}>{d.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
