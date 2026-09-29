// Хронометраж под голос. Пока записи нет, длина текста диктора переводится в кадры по средней
// скорости речи; когда запись есть, берётся её точная длина. Всё «под голос» (тезисы, карты, субтитры)
// ставится пропорционально месту фразы в тексте — для ровной начитки это совпадает с речью.
import {FPS} from '../brand';
import {SegTiming, Sub, YtSegment} from './types';

export const CPS = 15; // символов в секунду у диктора (≈ 900 знаков в минуту)
export const LEAD = 10; // кадров до начала голоса
export const XFADE = 45; // перекрёстное затухание музыки между треками

export const tailFor = (s: YtSegment) => (s.kind === 'outro' ? 150 : 14); // финал держится под конечную заставку YouTube
export const minFor = (s: YtSegment) => (s.kind === 'intro' || s.kind === 'outro' ? 120 : 150);

export const estimateVo = (text: string) => Math.ceil((text.length / CPS) * FPS);

// Кадр внутри сегмента, на котором диктор доходит до фразы anchor
export const anchorFrame = (t: SegTiming, vo: string, anchor: string) => {
  const i = vo.toLowerCase().indexOf(anchor.toLowerCase());
  if (i < 0) throw new Error(`Фраза «${anchor}» не найдена в тексте диктора сегмента «${t.id}»`);
  return t.voFrom + Math.round((i / vo.length) * t.voDur);
};

// Кадр для i-го из n элементов без явной привязки: равномерно по тексту
export const spreadFrame = (t: SegTiming, i: number, n: number) => t.voFrom + Math.round(t.voDur * (0.1 + (0.75 * i) / Math.max(1, n)));

// Для сцены: at(фраза) — кадр фразы; at(undefined, i, n) — равномерно; min — не раньше этого кадра
export const timeAt = (t: SegTiming, vo: string, min = 0) => (anchor: string | undefined, i = 0, n = 1) =>
  Math.max(min, anchor ? anchorFrame(t, vo, anchor) : spreadFrame(t, i, n));

const MAX_SUB = 84;

const byWords = (s: string) => {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && (cur + ' ' + w).length > MAX_SUB) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
};

// Текст диктора → строки субтитров: по предложениям, длинные — по запятым и тире, в крайнем случае по словам
export const splitSubs = (vo: string): string[] => {
  const out: string[] = [];
  for (const sentence of vo.split(/(?<=[.!?…])\s+/)) {
    if (sentence.length <= MAX_SUB) {
      out.push(sentence);
      continue;
    }
    let cur = '';
    for (const part of sentence.split(/(?<=[,;:])\s+|\s+(?=— )/)) {
      if (cur && (cur + ' ' + part).length > MAX_SUB) {
        out.push(...byWords(cur));
        cur = part;
      } else cur = cur ? `${cur} ${part}` : part;
    }
    if (cur) out.push(...byWords(cur));
  }
  return out.filter(Boolean);
};

export const buildSubs = (vo: string, voFrom: number, voDur: number): Sub[] => {
  const chunks = splitSubs(vo);
  const total = chunks.reduce((s, c) => s + c.length, 0);
  let acc = 0;
  return chunks.map((text) => {
    const from = voFrom + Math.round((acc / total) * voDur);
    acc += text.length;
    return {from, to: voFrom + Math.round((acc / total) * voDur), text};
  });
};
