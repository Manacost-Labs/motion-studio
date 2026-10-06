// Фон-атмосфера (config.ambience): тихие бесшовные петли под всем роликом — гул зала, камин. Петли разной длины
// (22 и 17 с), поэтому вместе не повторяются в такт. Уровень — на ~25 дБ тише голоса; вступает за 2 с, к концу уходит
import React from 'react';
import {Html5Audio, interpolate, staticFile} from 'remotion';
import {useK} from '../time/fps';
import {clamp} from '../time/ease';

const AMB_VOL = 0.16;
// timing.total — длина ролика в «кадрах-30»
export const Ambience: React.FC<{timing: {total: number}; layers: string[]}> = ({timing, layers}) => {
  const K = useK();
  return (
    <>
      {layers.map((src) => (
        <Html5Audio
          key={src}
          src={staticFile(src)}
          loop
          volume={(real) => {
            const f = real / K;
            return AMB_VOL * interpolate(f, [0, 60], [0, 1], clamp) * interpolate(f, [timing.total - 90, timing.total], [1, 0], clamp);
          }}
        />
      ))}
    </>
  );
};
