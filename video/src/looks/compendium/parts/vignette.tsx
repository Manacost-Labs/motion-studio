// Тёплая виньетка по краям пергамента (поверх всех сцен — look.Overlay)
import React from 'react';
import {AbsoluteFill} from 'remotion';

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 58%, rgba(70,38,12,0.28) 100%)'}} />
);
