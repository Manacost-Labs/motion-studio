// «Компендиум»: шапка из красного сукна, раздел «Главное» с тезисами, полупрозрачный персонаж, деревянная планка
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {DISPLAY} from '../../brand';
import {H, parchmentBg, ramp, redBg, TEXT} from '../theme';
import {Words} from './text';

export const BAND = 150; // высота шапки

export const Page: React.FC<{children?: React.ReactNode}> = ({children}) => <AbsoluteFill style={parchmentBg}>{children}</AbsoluteFill>;

// Деревянная планка под шапкой
export const WoodRule: React.FC<{y: number; w?: number; x?: number; h?: number}> = ({y, x = 0, w = 1920, h = 6}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, background: `linear-gradient(${H.woodSoft}, ${H.wood})`}} />
);

// Шапка: съезжает сверху; слева герб (или логотип), надзаголовок и заголовок; справа — место в топе
export const HeaderBand: React.FC<{
  kicker?: string;
  title: string;
  crest?: string; // путь к картинке герба/логотипа
  crestRound?: boolean;
  rank?: number;
  rankOf?: number;
  at?: number;
}> = ({kicker, title, crest, crestRound = true, rank, rankOf, at = 0}) => {
  const f = useCurrentFrame();
  const band = ramp(f, at, at + 14);
  const cp = ramp(f, at + 4, at + 20);
  const rp = ramp(f, at + 8, at + 26);
  const titleSize = title.length <= 18 ? 70 : title.length <= 26 ? 62 : 54;
  // круглый герб 106 px; прямоугольный логотип Манакоста 321×234 при высоте 106 → ~145 px
  const tx = crest ? (crestRound ? 196 : 64 + 146 + 30) : 72;
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: -BAND * (1 - band), width: 1920, height: BAND, ...redBg}} />
      <div style={{position: 'absolute', left: 0, top: BAND - BAND * (1 - band), width: 1920, height: 6, background: `linear-gradient(${H.woodSoft}, ${H.wood})`}} />
      {crest && (
        <Img
          src={crest}
          style={{
            position: 'absolute',
            left: 64,
            top: 22,
            height: 106,
            width: crestRound ? 106 : undefined,
            opacity: cp,
            scale: 0.85 + 0.15 * cp,
            filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.35))',
          }}
        />
      )}
      {kicker && (
        <div
          style={{
            position: 'absolute',
            left: tx + 4,
            top: 24,
            opacity: ramp(f, at + 8, at + 22),
            fontFamily: TEXT,
            fontWeight: 700,
            fontSize: 19,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: H.goldBright,
            whiteSpace: 'nowrap',
          }}
        >
          {kicker}
        </div>
      )}
      <Words
        text={title}
        at={at + 10}
        style={{position: 'absolute', left: tx, top: kicker ? 54 : 38, fontFamily: DISPLAY, fontSize: titleSize, lineHeight: 1.04, color: H.cream, whiteSpace: 'nowrap', textShadow: '0 3px 0 rgba(40,5,8,0.7)'}}
      />
      {rank !== undefined && (
        <div style={{position: 'absolute', right: 72, top: 14, display: 'flex', alignItems: 'center', gap: 18, opacity: rp}}>
          {rankOf && (
            <div style={{fontFamily: TEXT, fontWeight: 700, fontSize: 19, letterSpacing: '0.1em', color: H.cream, textTransform: 'uppercase', textAlign: 'right', lineHeight: 1.35, opacity: 0.85}}>
              место
              <br />
              из {rankOf}
            </div>
          )}
          <div style={{overflow: 'hidden', height: 124, padding: '0 4px'}}>
            <div style={{fontFamily: DISPLAY, fontSize: 118, lineHeight: 1.08, color: H.goldBright, textShadow: '0 4px 0 rgba(40,5,8,0.75)', translate: `0 ${(1 - rp) * 100}%`}}>{rank}</div>
          </div>
        </div>
      )}
    </>
  );
};

// Раздел «Главное»: ромб, подпись, линия; тезисы — номер красными чернилами, заголовок Belwe и пояснение.
// Все тезисы проявляются в начале сцены приглушёнными; тот, о котором сейчас говорит диктор, — в полную силу,
// уже прозвучавшие — чуть тише
export type MainItem = {title: string; detail?: string; at: number};
export const MainPoints: React.FC<{items: MainItem[]; x: number; y: number; w: number; label?: string; footer?: React.ReactNode; big?: boolean; at?: number}> = ({
  items,
  x,
  y,
  w,
  label = 'Главное',
  footer,
  big = false,
  at = 6,
}) => {
  const f = useCurrentFrame();
  const lp = ramp(f, at, at + 18);
  const ts = big ? 56 : 46;
  const ds = big ? 33 : 29;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, opacity: lp}}>
        <div style={{width: 10, height: 10, rotate: '45deg', background: H.red}} />
        <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 19, letterSpacing: '0.16em', color: H.inkMuted, textTransform: 'uppercase'}}>{label}</span>
        <div style={{flex: 1, height: 2, background: `linear-gradient(90deg, ${H.ink}55, transparent)`, scale: `${lp} 1`, transformOrigin: 'left'}} />
      </div>
      {items.map((it, i) => {
        const rev = at + 14 + i * 8; // проявление в начале сцены
        const p = ramp(f, rev, rev + 16);
        const dp = ramp(f, rev + 8, rev + 24);
        const lineP = ramp(f, rev + 6, rev + 26);
        const next = items[i + 1]?.at;
        const emph = 0.48 + 0.52 * ramp(f, it.at, it.at + 12) - (next === undefined ? 0 : 0.26 * ramp(f, next, next + 12));
        return (
          <div key={i} style={{position: 'relative', display: 'flex', gap: 24, padding: `${big ? 30 : 24}px 0 ${big ? 28 : 22}px`, opacity: emph}}>
            {i < items.length - 1 && <div style={{position: 'absolute', left: 0, bottom: 0, width: w * lineP, height: 1.5, background: `${H.ink}22`}} />}
            <span style={{fontFamily: DISPLAY, fontSize: ts * 1.3, lineHeight: 0.9, color: H.red, width: ts * 0.9, flexShrink: 0, textAlign: 'center', opacity: p, translate: `0 ${(1 - p) * 12}px`}}>
              {i + 1}
            </span>
            <div style={{minWidth: 0}}>
              <Words text={it.title} at={rev} stagger={1.5} style={{fontFamily: DISPLAY, fontSize: ts, lineHeight: 1.06, color: H.ink}} />
              {it.detail && (
                <div style={{fontFamily: TEXT, fontWeight: 500, fontSize: ds, lineHeight: 1.3, color: H.inkMuted, marginTop: 8, opacity: dp, translate: `0 ${(1 - dp) * 10}px`, textWrap: 'pretty'}}>
                  {it.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {footer && <div style={{marginTop: 26, opacity: ramp(f, at + 20, at + 36)}}>{footer}</div>}
    </div>
  );
};

// Полупрозрачный персонаж: вырезка, мягко растворяется к краям (как мурал на главной сайта)
export const Mural: React.FC<{src: string; x: number; y: number; h: number; opacity?: number; at?: number; mask?: string}> = ({src, x, y, h, opacity = 0.5, at = 0, mask}) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const p = ramp(f, at, at + 30);
  const m = mask ?? 'radial-gradient(ellipse at 50% 42%, #000 32%, transparent 72%)';
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height: h,
        opacity: opacity * p,
        translate: `${(f / durationInFrames) * -24}px ${(1 - p) * 30}px`,
        WebkitMaskImage: m,
        maskImage: m,
      }}
    />
  );
};

// Строка «пыль · код колоды» под тезисами
export const DeckFooter: React.FC<{dust?: number}> = ({dust}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 24, fontFamily: TEXT, fontWeight: 600, fontSize: 24, color: H.inkMuted}}>
    {dust !== undefined && (
      <>
        <span>
          {/* узкого неразрывного пробела из toLocaleString нет в Belwe — ставим обычный, иначе разрыв на полцифры */}
          <span style={{fontFamily: DISPLAY, fontSize: 32, color: H.ink, whiteSpace: 'nowrap'}}>{dust.toLocaleString('ru-RU').replace(/\s/g, ' ')}</span> пыли
        </span>
        <span style={{width: 7, height: 7, rotate: '45deg', background: H.red}} />
      </>
    )}
    <span>Код колоды — в описании</span>
  </div>
);
