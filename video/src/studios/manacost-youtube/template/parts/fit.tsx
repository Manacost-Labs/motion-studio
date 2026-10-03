// Подгонка кегля под ширину (@remotion/layout-utils): заголовок любой длины не вылезает за рамку — шрифт сам
// уменьшается до размера, при котором самая длинная строка помещается в width (но не больше max и не меньше min).
// Мерить можно только загруженным шрифтом: хук ждёт document.fonts.ready (рендер кадра придерживается delayRender),
// до этого отдаёт max. Все хуки вызывать безусловно — и для текста, который появится позже
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {fitText} from '@remotion/layout-utils';

export const FIT_DISPLAY = 'HSDisplay'; // семейство заголовочного шрифта (brand/base.ts) — для измерения
const fonts = typeof document === 'undefined' ? undefined : document.fonts;
let loaded = fonts?.status === 'loaded';
const ready = fonts ? fonts.ready.then(() => void (loaded = true)) : Promise.resolve();

export const useFitSize = (text: string, o: {width: number; max: number; min?: number; fontFamily?: string; fontWeight?: number}) => {
  const [ok, setOk] = useState(loaded);
  useEffect(() => {
    if (ok) return;
    const handle = delayRender('шрифты для подгонки текста');
    ready.then(() => {
      setOk(true);
      continueRender(handle);
    });
  }, [ok]);
  if (!ok || !text) return o.max;
  const sizes = text.split('\n').map((line) => fitText({text: line, withinWidth: o.width, fontFamily: o.fontFamily ?? FIT_DISPLAY, fontWeight: o.fontWeight}).fontSize);
  return Math.max(o.min ?? 0, Math.min(o.max, ...sizes));
};
