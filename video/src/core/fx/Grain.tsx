// Зерно плёнки: мелкий шум меняется каждый кадр
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useFrame} from '../time/fps';

export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.05}) => {
  const f = useFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity}}>
      <svg width="960" height="540" style={{width: '100%', height: '100%'}} preserveAspectRatio="none">
        <filter id="yt-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="960" height="540" filter="url(#yt-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
