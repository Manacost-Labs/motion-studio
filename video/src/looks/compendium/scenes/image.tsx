// Скриншот (сайт, игра, Reddit) — «Компендиум»: кадр в деревянной раме с медленным наездом, подпись и источник.
// Картинку положить в public (например yt/<ролик>/shot.png). Для чужих скриншотов всегда указывать credit
import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile} from 'remotion';
import {HeaderBand, Page} from '../parts';
import {SceneBody} from '../motion';
import {H, ramp, TEXT, timber} from '../theme';
import type {SegTiming} from '../../../core/video/types';
import type {ImageSeg} from '../types';
import {defineScene} from '../../../core/video/registry';
import {useFrame} from '../../../core/time/fps';

export const ImageScene: React.FC<{seg: ImageSeg; t: SegTiming}> = ({seg, t}) => {
  const f = useFrame();
  const p = ramp(f, 8, 30);
  const cap = ramp(f, 20, 36);
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        <div style={{position: 'absolute', left: 0, right: 0, top: 190, height: 690, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: p, translate: `0 ${(1 - p) * 40}px`}}>
          <div style={{...timber(16), overflow: 'hidden', boxShadow: '0 24px 50px rgba(60,25,10,0.4)'}}>
            <Img
              src={staticFile(seg.src)}
              style={{display: 'block', maxWidth: 1640, maxHeight: 600, objectFit: 'contain', objectPosition: seg.focus, scale: interpolate(f, [0, t.dur], [1, 1.05])}}
            />
          </div>
          <div style={{display: 'flex', gap: 40, marginTop: 16, opacity: cap, fontFamily: TEXT}}>
            {seg.caption && <span style={{fontWeight: 600, fontSize: 28, color: H.ink}}>{seg.caption}</span>}
            {seg.credit && <span style={{fontWeight: 500, fontSize: 22, color: H.inkMuted}}>{seg.credit}</span>}
          </div>
        </div>
      </SceneBody>
      <HeaderBand kicker={seg.kicker} title={seg.title ?? ''} />
    </AbsoluteFill>
  );
};

export const image = defineScene<ImageSeg>({kind: 'image', Component: ImageScene});
