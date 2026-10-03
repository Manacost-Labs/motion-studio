// Проба «живого» арта (template/parts/depth.tsx): 10 с камеры по одному арту, не для публикации.
// Другой арт: --props='{"src":"art/badlands.jpg"}' (карта глубины — scripts/depth.py). Рендер с --gl=angle.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FrameScale} from '../template/fps';
import {DepthArt} from '../template/parts';

export const DEPTH_LAB_DURATION = 600; // 10 с при 60 к/с

export const DepthLab: React.FC<{src: string}> = ({src}) => (
  <FrameScale value={2}>
    <AbsoluteFill style={{background: '#000'}}>
      <DepthArt src={src} from={{x: -1, y: 0.2, zoom: 1.1, dolly: 0}} to={{x: 1, y: -0.2, zoom: 1.2, dolly: 0.08}} dur={300} />
    </AbsoluteFill>
  </FrameScale>
);
