// «Компендиум»: шапка из красного сукна, раздел «Главное» с тезисами, полупрозрачный персонаж, деревянная планка
import React from 'react';
import {AbsoluteFill, Img, staticFile, useVideoConfig} from 'remotion';
import {DISPLAY} from '../../brand';
import {EASE_IN_OUT, H, parchmentBg, ramp, redBg, TEXT} from '../theme';
import {useSceneMotion} from './motion';
import {Sfx} from './stage';
import {Words} from './text';
import {useFrame, useK} from '../fps';

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
  next?: {at: number; kicker?: string; title: string}; // смена надписей посреди сцены: полоса и герб стоят, текст меняется
}> = ({kicker, title, crest, crestRound = true, rank, rankOf, at = 0, next}) => {
  const f = useFrame();
  const {persistBand, prevRank, prevRankOf} = useSceneMotion();
  // на стыке сцен полоса уже стоит (её рисовала прошлая сцена) — не съезжает заново
  const band = persistBand ? 1 : ramp(f, at, at + 14);
  const cp = ramp(f, at + 4, at + 20);
  const rp = persistBand && rank !== undefined && prevRank !== undefined ? 1 : ramp(f, at + 8, at + 26);
  // номер места прокручивается со старого на новый, как счётчик
  const roll = prevRank !== undefined && prevRank !== rank ? ramp(f, at + 2, at + 22, EASE_IN_OUT) : 1;
  // в новой сцене места нет (финал после №1) — старое место уезжает вверх, подпись гаснет, а не пропадает за кадр
  const leave = rank === undefined && persistBand && prevRank !== undefined ? ramp(f, at + 2, at + 22, EASE_IN_OUT) : 1;
  const of = rankOf ?? (rank === undefined ? prevRankOf : undefined);
  // круглый герб 106 px; прямоугольный логотип Манакоста 321×234 при высоте 106 → ~145 px
  const tx = crest ? (crestRound ? 196 : 64 + 146 + 30) : 72;
  // надзаголовок и заголовок; out — кадр, с которого они уходят вверх (их сменяют надписи next)
  const texts = (k: string | undefined, t: string, a: number, out?: number) => {
    const o = out === undefined ? 0 : ramp(f, out, out + 10, EASE_IN_OUT);
    if (o >= 1) return null;
    return (
      <div style={{position: 'absolute', inset: 0, opacity: 1 - o, translate: `0 ${-o * 16}px`}}>
        {k && (
          <div
            style={{
              position: 'absolute',
              left: tx + 4,
              top: 24,
              opacity: ramp(f, a + 8, a + 22),
              fontFamily: TEXT,
              fontWeight: 700,
              fontSize: 19,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: H.goldBright,
              whiteSpace: 'nowrap',
            }}
          >
            {k}
          </div>
        )}
        <Words
          text={t}
          at={a + 10}
          style={{position: 'absolute', left: tx, top: k ? 54 : 38, fontFamily: DISPLAY, fontSize: t.length <= 18 ? 70 : t.length <= 26 ? 62 : 54, lineHeight: 1.04, color: H.cream, whiteSpace: 'nowrap', textShadow: '0 3px 0 rgba(40,5,8,0.7)'}}
        />
      </div>
    );
  };
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
      {texts(kicker, title, at, next?.at)}
      {next && f >= next.at && texts(next.kicker, next.title, next.at)}
      {(rank !== undefined || leave < 1) && (
        <div style={{position: 'absolute', right: 72, top: 14, display: 'flex', alignItems: 'center', gap: 18, opacity: rank !== undefined ? rp : 1}}>
          {of && (
            <div style={{fontFamily: TEXT, fontWeight: 700, fontSize: 19, letterSpacing: '0.1em', color: H.cream, textTransform: 'uppercase', textAlign: 'right', lineHeight: 1.35, opacity: 0.85 * (rank !== undefined ? 1 : 1 - leave)}}>
              место
              <br />
              из {of}
            </div>
          )}
          <div style={{overflow: 'hidden', height: 124, padding: '0 4px', position: 'relative'}}>
            {rank !== undefined && roll < 1 && (
              <div style={{position: 'absolute', right: 4, fontFamily: DISPLAY, fontSize: 118, lineHeight: 1.08, color: H.goldBright, textShadow: '0 4px 0 rgba(40,5,8,0.75)', translate: `0 ${-roll * 100}%`}}>{prevRank}</div>
            )}
            <div style={{fontFamily: DISPLAY, fontSize: 118, lineHeight: 1.08, color: H.goldBright, textShadow: '0 4px 0 rgba(40,5,8,0.75)', translate: `0 ${rank === undefined ? -leave * 100 : roll < 1 ? (1 - roll) * 100 : (1 - rp) * 100}%`}}>{rank ?? prevRank}</div>
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
// ts/ds — размер заголовка и пояснения тезиса, если нужен не из двух готовых (big — для сцены тезисов);
// h — высота блока: тезисы делят её поровну и стоят по центру своих долей (колонка заполнена, без пустого низа)
export const MainPoints: React.FC<{items: MainItem[]; x: number; y: number; w: number; h?: number; label?: string; footer?: React.ReactNode; big?: boolean; at?: number; ts?: number; ds?: number}> = ({
  items,
  x,
  y,
  w,
  h,
  label = 'Главное',
  footer,
  big = false,
  at = 6,
  ts = big ? 56 : 46,
  ds = big ? 33 : 29,
}) => {
  const f = useFrame();
  const lp = ramp(f, at, at + 18);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, display: h ? 'flex' : undefined, flexDirection: 'column'}}>
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
        const on = ramp(f, it.at, it.at + 12);
        const off = next === undefined ? 0 : ramp(f, next, next + 12);
        const emph = 0.48 + 0.52 * on - 0.26 * off;
        const active = on * (1 - off); // тезис, о котором говорит диктор: чуть вперёд и красная черта чернилами
        return (
          <div key={i} style={{position: 'relative', flex: h ? 1 : undefined, display: 'flex', alignItems: 'center', padding: `${big ? 30 : 24}px 0 ${big ? 28 : 22}px`, opacity: emph, translate: `${active * 10}px 0`}}>
            <div style={{display: 'flex', gap: 24}}>
            {i < items.length - 1 && <div style={{position: 'absolute', left: 0, bottom: 0, width: w * lineP, height: 1.5, background: `${H.ink}22`}} />}
            <span style={{fontFamily: DISPLAY, fontSize: ts * 1.3, lineHeight: 0.9, color: H.red, width: ts * 0.9, flexShrink: 0, textAlign: 'center', opacity: p, translate: `0 ${(1 - p) * 12}px`}}>
              {i + 1}
            </span>
            <div style={{minWidth: 0}}>
              <Words text={it.title} at={rev} stagger={1.5} mark={ramp(f, it.at + 2, it.at + 20) * (1 - off)} markColor={H.red} style={{fontFamily: DISPLAY, fontSize: ts, lineHeight: 1.06, color: H.ink}} />
              {/* росчерк пера под чертой (scripts/foley.mjs) */}
              <Sfx file="lib/sfx/quill-scratch.wav" at={it.at + 2} volume={0.043} />
              {it.detail && (
                <div style={{fontFamily: TEXT, fontWeight: 500, fontSize: ds, lineHeight: 1.3, color: H.inkMuted, marginTop: 8, opacity: dp, translate: `0 ${(1 - dp) * 10}px`, textWrap: 'pretty'}}>
                  {it.detail}
                </div>
              )}
            </div>
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
  const f = useFrame();
  const durationInFrames = useVideoConfig().durationInFrames / useK();
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

// Строка «пыль · код колоды» под тезисами; стоимость в пыли отсчитывается вверх, пока строка появляется
export const DeckFooter: React.FC<{dust?: number}> = ({dust}) => {
  const f = useFrame();
  const shown = dust === undefined ? 0 : Math.round((dust * ramp(f, 26, 62)) / 20) * 20;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 24, fontFamily: TEXT, fontWeight: 600, fontSize: 24, color: H.inkMuted}}>
      {dust !== undefined && <Sfx file="lib/sfx/coin-trickle.wav" at={26} volume={0.13} />}
      {dust !== undefined && (
        <>
          <span>
            {/* узкого неразрывного пробела из toLocaleString нет в Belwe — ставим обычный, иначе разрыв на полцифры */}
            <span style={{fontFamily: DISPLAY, fontSize: 32, color: H.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>{shown.toLocaleString('ru-RU').replace(/\s/g, ' ')}</span> пыли
          </span>
          <span style={{width: 7, height: 7, rotate: '45deg', background: H.red}} />
        </>
      )}
      <span>Код колоды — в описании</span>
    </div>
  );
};
