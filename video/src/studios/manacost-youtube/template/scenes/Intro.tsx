// Вступление — «Компендиум»: шапка из сукна с логотипом, крупный заголовок чернилами на пергаменте,
// строка гербов классов подборки (появляются по очереди) и полупрозрачный паладин справа.
// tease — постеры топа веером под размытием: кто на вершине, зритель узнает в конце
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {DISPLAY, MANACOST} from '../../brand';
import {crestFor, HeaderBand, Mural, Page, SceneBody, useFitSize, Words} from '../parts';
import {H, ramp, TEXT, timber} from '../theme';
import {timeAt} from '../timing';
import {staticFile} from 'remotion';
import {IntroSeg, SegTiming} from '../types';
import {useFrame} from '../fps';

export const IntroScene: React.FC<{seg: IntroSeg; t: SegTiming}> = ({seg, t}) => {
  const titleSize = useFitSize(seg.title, {width: 940, max: 150, min: 80}); // до мурала и постеров справа
  const f = useFrame();
  const classes = seg.classes ?? [];
  const kp = ramp(f, 16, 34);
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        <Mural src={seg.mural ?? 'brand/arena/home-paladin-hero.webp'} x={1060} y={170} h={960} opacity={seg.tease ? 0.4 : 0.55} at={6} mask="linear-gradient(90deg, transparent 0%, #000 30%, #000 80%, transparent 100%)" />
        {/* постеры топа — на фразе teaseAt (например «на вершине»), без неё — с середины речи */}
        {seg.tease && <Tease srcs={seg.tease} at={seg.teaseAt ? timeAt(t, seg.vo, 24)(seg.teaseAt) : Math.round(t.voFrom + t.voDur * 0.5)} />}
        <div style={{position: 'absolute', left: 96, top: 262, display: 'flex', alignItems: 'center', gap: 14, opacity: kp}}>
          <div style={{width: 11, height: 11, rotate: '45deg', background: H.red}} />
          <span style={{fontFamily: TEXT, fontWeight: 800, fontSize: 24, letterSpacing: '0.14em', color: H.inkMuted, textTransform: 'uppercase'}}>{seg.kicker}</span>
        </div>
        <Words text={seg.title} at={20} stagger={3} dur={20} style={{position: 'absolute', left: 90, top: 312, fontFamily: DISPLAY, fontSize: titleSize, lineHeight: 1.02, color: H.ink}} />
        {seg.sub && (
          <div style={{position: 'absolute', left: 96, top: 640, fontFamily: TEXT, fontWeight: 500, fontSize: 36, color: H.inkMuted, opacity: ramp(f, 40, 58), translate: `0 ${(1 - ramp(f, 40, 58)) * 12}px`}}>
            {seg.sub}
          </div>
        )}
        <div style={{position: 'absolute', left: 96, top: 730, display: 'flex', gap: 10, flexWrap: 'wrap', width: 900}}>
          {classes.map((c, i) => {
            const at = t.voFrom + (t.voDur * 0.55 * i) / Math.max(1, classes.length);
            const p = ramp(f, at, at + 14);
            return <Img key={i} src={crestFor(c)} style={{width: 72, height: 72, opacity: p, scale: 0.8 + 0.2 * p, filter: 'drop-shadow(0 4px 6px rgba(60,25,10,0.35))'}} />;
          })}
        </div>
      </SceneBody>
      <HeaderBand kicker={MANACOST.site} title={MANACOST.name} crest={staticFile(MANACOST.logo)} crestRound={false} />
    </AbsoluteFill>
  );
};

// Три постера веером под размытием, в деревянных рамах; на переднем — вопрос. Появляются по одному под голос
const Tease: React.FC<{srcs: string[]; at: number}> = ({srcs, at}) => {
  const f = useFrame();
  const fan = [
    {x: 1150, y: 300, r: -7},
    {x: 1390, y: 250, r: 6},
    {x: 1260, y: 420, r: -1},
  ];
  return (
    <>
      {srcs.slice(0, 3).map((src, i) => {
        const p = ramp(f, at + i * 7, at + i * 7 + 20);
        const front = i === srcs.length - 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: fan[i].x,
              top: fan[i].y,
              width: 440,
              height: 360,
              rotate: `${fan[i].r}deg`,
              opacity: p,
              translate: `0 ${(1 - p) * 40}px`,
              ...timber(14),
              boxShadow: '0 22px 34px rgba(60,25,10,0.4)',
              overflow: 'hidden',
              background: H.parchment,
            }}
          >
            <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'blur(9px) sepia(0.25)', scale: 1.08}} />
            {front && (
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontSize: 200, color: H.cream, textShadow: '0 6px 0 rgba(40,5,8,0.7), 0 0 30px rgba(40,5,8,0.35)'}}>?</div>
            )}
          </div>
        );
      })}
    </>
  );
};
