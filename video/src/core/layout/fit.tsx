// Подгонка кегля под ширину (@remotion/layout-utils): заголовок любой длины не вылезает за рамку — шрифт сам
// уменьшается до размера, при котором самая длинная строка помещается в width (но не больше max и не меньше min).
// Мерить можно только загруженным шрифтом. Шрифт ролика грузится асинхронно (loadFont: FontFace попадает в
// document.fonts только после загрузки), поэтому флаг «шрифты готовы», снятый при импорте, ненадёжен: кадр мог
// измериться запасным шрифтом. Хук на каждом экземпляре проверяет, что семейство уже в document.fonts и загружено
// (с нужным начертанием и знаками текста), иначе держит кадр delayRender, ждёт шрифт и только потом меряет; до этого отдаёт max.
// Все хуки вызывать безусловно — и для текста, который появится позже
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {fitText} from '@remotion/layout-utils';

export const FIT_DISPLAY = 'HSDisplay'; // семейство по умолчанию — заголовочный шрифт «Компендиума» (грузит looks/compendium/theme.ts)
const WAIT_MS = 15000; // дольше шрифт не ждём: меряем как есть и предупреждаем в консоли

const fonts = () => (typeof document === 'undefined' ? undefined : document.fonts);
const unquote = (s: string) => s.replace(/^["']|["']$/g, '');
const spec = (family: string, weight?: number) => `${weight ?? 'normal'} 100px "${family}"`;

// семейство уже добавлено в document.fonts, загружено, и знаки текста нужным начертанием доступны
const isReady = (family: string, weight: number | undefined, text: string) => {
  const set = fonts();
  if (!set) return false;
  let added = false;
  set.forEach((f) => {
    if (unquote(f.family) === family && f.status === 'loaded') added = true;
  });
  return added && set.check(spec(family, weight), text || 'A');
};

// ждём, пока семейство появится в document.fonts, затем догружаем нужное начертание и знаки (подмножества unicode-range)
const waitFont = async (family: string, weight: number | undefined, text: string) => {
  const set = fonts();
  if (!set) return;
  const t0 = Date.now();
  while (!isReady(family, weight, text)) {
    if (Date.now() - t0 > WAIT_MS) {
      console.warn(`useFitSize: шрифт «${family}» не загрузился за ${WAIT_MS / 1000} с — кегль подогнан по запасному`);
      return;
    }
    await set.load(spec(family, weight), text || 'A').catch(() => []);
    if (!isReady(family, weight, text)) await new Promise((r) => setTimeout(r, 25));
  }
};

export const useFitSize = (text: string, o: {width: number; max: number; min?: number; fontFamily?: string; fontWeight?: number}) => {
  const family = o.fontFamily ?? FIT_DISPLAY;
  const [ok, setOk] = useState(() => isReady(family, o.fontWeight, text));
  useEffect(() => {
    if (ok || !fonts()) return;
    let live = true;
    const handle = delayRender(`шрифт ${family} для подгонки текста`);
    waitFont(family, o.fontWeight, text).then(() => {
      if (live) setOk(true);
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [ok, family, o.fontWeight, text]);
  if (!ok || !text) return o.max;
  const sizes = text.split('\n').map((line) => fitText({text: line, withinWidth: o.width, fontFamily: family, fontWeight: o.fontWeight}).fontSize);
  return Math.max(o.min ?? 0, Math.min(o.max, ...sizes));
};
