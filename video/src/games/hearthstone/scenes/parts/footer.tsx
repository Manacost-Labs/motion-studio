// Строка под тезисами колоды: стоимость в пыли и «код колоды — в описании» (Hearthstone; стиль — looks/compendium)
import React from 'react';
import {DISPLAY, H, ramp, TEXT} from '../../../../looks/compendium/theme';
import {Sfx} from '../../../../core/audio/Sfx';
import {useFrame} from '../../../../core/time/fps';

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
