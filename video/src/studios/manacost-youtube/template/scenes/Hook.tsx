// Сильное начало — до вступления, 3–5 с: самый яркий факт ролика на красном сукне. Слева крупное золотое число
// выезжает из-под маски и отсчитывается на своей фразе (удар барабана, когда досчитало), под ним подпись; справа веер карт
// влетает снизу; внизу добивка с гербом. Веер медленно наезжает — кадр не стоит. Дальше страница вступления
// перелистывается поверх сукна, а сукно остаётся её шапкой
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {DISPLAY} from '../../brand';
import {crestFor, hsRender, SceneBody, Sfx, Words} from '../parts';
import {EASE_IN_OUT, H, ramp, redBg, TEXT} from '../theme';
import {timeAt} from '../timing';
import {HookSeg, SegTiming} from '../types';
import {useFrame} from '../fps';

const COUNT = 22; // кадров на отсчёт числа
const FAN = {cx: 1420, cy: 560, h: 600, step: 235, tilt: 11}; // веер справа; слева колонка текста до x≈900

export const HookScene: React.FC<{seg: HookSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useFrame();
  const at = timeAt(t, seg.vo, 0);
  const a = seg.at ? at(seg.at) : 8;
  const n = ramp(f, a - 6, a + 10); // число выезжает чуть раньше фразы
  const shown = Math.round(seg.value * ramp(f, a - 6, a + COUNT - 6, EASE_IN_OUT)); // отсчёт идёт, пока число выезжает
  const lp = ramp(f, a + 8, a + 24);
  const pa = at(seg.punch.at);
  const pp = ramp(f, pa - 4, pa + 14);
  const drift = f / t.dur;
  const mid = (seg.cards.length - 1) / 2;
  return (
    <SceneBody>
      <AbsoluteFill style={redBg} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, background: `linear-gradient(${H.woodSoft}, ${H.wood})`}} />
      {/* веер карт: каждая влетает снизу на своей фразе (или по очереди с начала) */}
      <div style={{position: 'absolute', inset: 0, scale: 1 + 0.045 * drift, translate: `${-24 * drift}px 0`, transformOrigin: `${FAN.cx}px ${FAN.cy}px`}}>
        {seg.cards.map((c, i) => {
          const ct = c.at ? at(c.at) : 2 + i * 5;
          const p = ramp(f, ct, ct + 18);
          const k = i - mid;
          return (
            <Img
              key={i}
              src={hsRender(c.id)}
              style={{
                position: 'absolute',
                left: FAN.cx + k * FAN.step,
                top: FAN.cy - FAN.h / 2 + Math.abs(k) * 34,
                height: FAN.h,
                translate: `-50% ${(1 - p) * 280}px`,
                rotate: `${k * FAN.tilt + (1 - p) * 8}deg`,
                transformOrigin: '50% 100%',
                opacity: Math.min(1, p * 3),
                filter: 'drop-shadow(0 22px 26px rgba(30,4,6,0.55))',
              }}
            />
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 130, top: 120, height: 480, overflow: 'hidden', padding: '0 10px'}}>
        <div style={{fontFamily: DISPLAY, fontSize: 440, lineHeight: 1.05, color: H.goldBright, textShadow: '0 10px 0 rgba(40,5,8,0.75)', fontVariantNumeric: 'tabular-nums', translate: `0 ${(1 - n) * 100}%`}}>{shown}</div>
      </div>
      <div style={{position: 'absolute', left: 150, top: 606, opacity: lp, translate: `0 ${(1 - lp) * 12}px`, fontFamily: TEXT, fontWeight: 800, fontSize: 34, letterSpacing: '0.2em', color: H.cream, textTransform: 'uppercase'}}>{seg.label}</div>
      <div style={{position: 'absolute', left: 146, top: 724, width: 760, display: 'flex', alignItems: 'flex-start', gap: 26}}>
        {seg.punch.cls && <Img src={crestFor(seg.punch.cls)} style={{width: 92, height: 92, opacity: pp, scale: 0.85 + 0.15 * pp, filter: 'drop-shadow(0 5px 8px rgba(0,0,0,0.35))'}} />}
        <Words text={seg.punch.text} at={pa - 2} stagger={2} style={{fontFamily: DISPLAY, fontSize: 66, lineHeight: 1.08, color: H.cream, textShadow: '0 3px 0 rgba(40,5,8,0.7)', textWrap: 'balance'}} />
      </div>
      {seg.cards.map((c, i) => (
        <Sfx key={i} file="lib/sfx/card-draw.wav" at={c.at ? at(c.at) : 2 + i * 5} volume={0.2} />
      ))}
      <Sfx file="lib/sfx/drum-hit.wav" at={a + COUNT - 8} volume={0.38} />
    </SceneBody>
  );
};
