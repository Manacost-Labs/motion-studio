// Детали «Газеты»: линейка, шапка номера, слова из-под маски, штамп, фото номера, строка «было → стало», подвал.
// Движение — только transform и opacity (медленное движение без пиксельного дрожания), мягкие кривые, без отскоков и тряски
import React from 'react';
import {Img} from 'remotion';
import {useFrame} from '../../core/time/fps';
import {EASE_IN_OUT, ramp} from '../../core/time/ease';
import {G, HEAD, LABEL, PAGE, STAMP_INK, TEXT, VERDICT_RU, type Verdict} from './theme';

// Линейка: печатается от центра к краям (scaleX), w — толщина
export const Rule: React.FC<{at: number; w?: number; dur?: number; style?: React.CSSProperties}> = ({at, w = 1, dur = 14, style}) => {
  const p = ramp(useFrame(), at, at + dur, EASE_IN_OUT);
  return <div style={{height: w, background: G.ink, transform: `scaleX(${p})`, ...style}} />;
};

// Слова выезжают снизу из-под маски по очереди
export const Words: React.FC<{text: string; at: number; stagger?: number; dur?: number; style?: React.CSSProperties}> = ({text, at, stagger = 2, dur = 14, style}) => {
  const f = useFrame();
  let i = 0;
  return (
    <div style={style}>
      {text.split('\n').map((line, li) => (
        <div key={li}>
          {line.split(' ').map((w, wi) => {
            const p = ramp(f, at + i * stagger, at + i++ * stagger + dur);
            return (
              <span key={wi} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', padding: '0.06em 0 0.14em', margin: '-0.06em 0.24em -0.14em 0'}}>
                <span style={{display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`}}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Появление блока: проявляется и чуть поднимается
export const Rise: React.FC<{at: number; dur?: number; dy?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({at, dur = 16, dy = 18, style, children}) => {
  const p = ramp(useFrame(), at, at + dur);
  return <div style={{opacity: p, transform: `translateY(${(1 - p) * dy}px)`, ...style}}>{children}</div>;
};

// Штамп: двойная рамка, прописные, постоянный лёгкий поворот. Ложится оттиском — чуть крупнее и прозрачнее, затем на место
// за 6 кадров; дальше неподвижен (никакой тряски)
export const Stamp: React.FC<{v: Verdict; size: number; rotate: number; at?: number}> = ({v, size, rotate, at}) => {
  const p = at === undefined ? 1 : ramp(useFrame(), at, at + 6);
  return (
    <div
      style={{
        display: 'inline-block',
        transform: `rotate(${rotate}deg) scale(${1.18 - 0.18 * p})`,
        opacity: p,
        border: `${Math.round(size / 9)}px double ${STAMP_INK[v]}`,
        padding: `${size * 0.08}px ${size * 0.35}px ${size * 0.04}px`,
        fontFamily: LABEL,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: size * 0.08,
        color: STAMP_INK[v],
        textTransform: 'uppercase',
        lineHeight: 1.1,
      }}
    >
      {VERDICT_RU[v]}
    </div>
  );
};

// Шапка номера: двойная линейка печатается, название номера выезжает, подписи по краям проявляются
export const Masthead: React.FC<{title: string; left: string; right: string; at?: number}> = ({title, left, right, at = 0}) => (
  <div style={{position: 'absolute', left: PAGE.left, right: PAGE.right, top: PAGE.top}}>
    <Rule at={at} w={2} />
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 6px'}}>
      <Rise at={at + 12} dy={0} style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, letterSpacing: 2, color: G.grey, width: 380, textTransform: 'uppercase'}}>
        {left}
      </Rise>
      <Words text={title} at={at + 6} stagger={3} dur={16} style={{fontFamily: HEAD, fontWeight: 900, fontSize: 104, lineHeight: 1, letterSpacing: 1, color: G.ink}} />
      <Rise at={at + 12} dy={0} style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, letterSpacing: 2, color: G.grey, width: 380, textAlign: 'right', textTransform: 'uppercase'}}>
        {right}
      </Rise>
    </div>
    <Rule at={at + 4} w={5} />
    <Rule at={at + 8} w={1} style={{marginTop: 4}} />
  </div>
);

// Фото номера: снимок в тонкой рамке, медленно приближается (transform — без дрожания), подпись курсивом
export const Photo: React.FC<{src: string; w: number; h: number; caption: string; at: number; dur: number}> = ({src, w, h, caption, at, dur}) => {
  const f = useFrame();
  const p = ramp(f, at, at + 18);
  const zoom = 1 + 0.035 * ramp(f, at, at + dur, EASE_IN_OUT);
  return (
    <div style={{opacity: p, transform: `translateY(${(1 - p) * 22}px)`}}>
      <div style={{width: w, height: h, overflow: 'hidden', outline: `1px solid ${G.ink}`}}>
        <Img src={src} style={{width: w, height: h, display: 'block', transform: `scale(${zoom})`, transformOrigin: '50% 40%'}} />
      </div>
      <div style={{fontFamily: TEXT, fontStyle: 'italic', fontSize: 24, color: G.grey, marginTop: 10}}>{caption}</div>
    </div>
  );
};

// Строка таблицы «ранг — было — стало»: ранг и прежнее значение проявляются, прежнее перечёркивается, новое выезжает краской
export const ChangeRow: React.FC<{rank: string; before: string; after: string; at: number; color: string}> = ({rank, before, after, at, color}) => {
  const f = useFrame();
  const row = ramp(f, at, at + 12);
  const strike = ramp(f, at + 8, at + 20, EASE_IN_OUT);
  const next = ramp(f, at + 12, at + 26);
  // рамка и прозрачность — у ячеек, таблица — с раздельными рамками (borderCollapse: 'separate'): слитые Chrome рисует всегда
  const cell: React.CSSProperties = {borderTop: `1px solid ${G.ink}`, opacity: row};
  return (
    <tr>
      <td style={{...cell, fontSize: 40, fontWeight: 500, padding: '8px 0'}}>{rank}</td>
      <td style={{...cell, fontSize: 40, fontWeight: 500, textAlign: 'right', color: G.grey}}>
        <span style={{position: 'relative', display: 'inline-block'}}>
          {before}
          <span style={{position: 'absolute', left: -4, right: -4, top: '54%', height: 3, background: G.grey, transform: `scaleX(${strike})`, transformOrigin: '0 50%'}} />
        </span>
      </td>
      <td style={{...cell, fontSize: 48, fontWeight: 700, textAlign: 'right', color}}>
        <span style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom'}}>
          <span style={{display: 'inline-block', transform: `translateY(${(1 - next) * 105}%)`}}>{after}</span>
        </span>
      </td>
    </tr>
  );
};

// Подвал полосы: линейка и две подписи (источник и оговорка)
export const Footer: React.FC<{left: string; right: string; at: number}> = ({left, right, at}) => (
  <div style={{position: 'absolute', left: PAGE.left, right: PAGE.right, bottom: PAGE.bottom}}>
    <Rule at={at} w={2} />
    <Rise at={at + 8} dy={0} style={{display: 'flex', justifyContent: 'space-between', fontFamily: TEXT, fontSize: 24, color: G.grey, marginTop: 10}}>
      <span>{left}</span>
      <span>{right}</span>
    </Rise>
  </div>
);
