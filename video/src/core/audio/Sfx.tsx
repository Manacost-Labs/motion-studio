// Звуковой эффект из public (например lib/sfx/card-draw.wav) на кадре at
// at — в «кадрах-30» (core/time/fps.ts), Sequence — в настоящих кадрах ролика
import React from 'react';
import {Html5Audio, Sequence, staticFile} from 'remotion';
import {useK} from '../time/fps';

export const Sfx: React.FC<{file: string; at: number; volume?: number}> = ({file, at, volume = 0.3}) => {
  const K = useK();
  return (
    <Sequence from={Math.max(0, Math.round(at * K))} durationInFrames={90 * K} layout="none">
      <Html5Audio src={staticFile(file)} volume={volume} />
    </Sequence>
  );
};
