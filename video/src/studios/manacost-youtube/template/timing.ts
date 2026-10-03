// Хронометраж под голос. Пока записи нет, длина текста диктора переводится в кадры по средней скорости речи,
// а всё «под голос» (тезисы, карты, субтитры) ставится пропорционально месту фразы в тексте.
// Когда запись есть (public/vo/<id>/<сегмент>.mp3 + .json от scripts/tts.mjs или vo-align.mjs), в json лежит время
// каждого символа текста — привязки и субтитры встают точно на слово.
// Аудиотеги v4 в тексте ([pause], [excited]) диктор исполняет, а на экран и в субтитры они не попадают.
import {FPS} from '../brand';
import {OutroSeg, SegTiming, Sub, YtSegment} from './types';

export const CPS = 15; // символов в секунду у диктора (≈ 900 знаков в минуту)
export const LEAD = 10; // кадров до начала голоса
export const XFADE = 45; // перекрёстное затухание музыки между треками

export const tailFor = (s: YtSegment) => (s.kind === 'outro' ? 150 : 14); // финал держится под конечную заставку YouTube
// Пауза до голоса: у мест топ-3 — дольше, пока идёт заставка места (scenes/Deck.tsx → RankReveal)
export const TOP_REVEAL = 3;
export const leadFor = (s: YtSegment) => (s.kind === 'deck' && s.rank !== undefined && s.rank <= TOP_REVEAL ? 26 : LEAD);
export const DIVIDER = 78; // длина разделителя блоков (без голоса)
export const minFor = (s: YtSegment) => (s.kind === 'divider' ? DIVIDER : s.kind === 'hook' || s.kind === 'intro' || s.kind === 'outro' ? 120 : 150);

// Текст на экране: без аудиотегов
export const stripTags = (vo: string) => vo.replace(/\[[^\]]*\]\s*/g, '');

export const estimateVo = (text: string) => Math.ceil((stripTags(text).length / CPS) * FPS);

// Кадр внутри сегмента, на котором диктор доходит до фразы anchor
export const anchorFrame = (t: SegTiming, vo: string, anchor: string) => {
  const shown = stripTags(vo);
  const i = shown.toLowerCase().indexOf(anchor.toLowerCase());
  if (i < 0) throw new Error(`Фраза «${anchor}» не найдена в тексте диктора сегмента «${t.id}»`);
  if (t.times) return t.voFrom + Math.round(t.times.start[i] * FPS);
  return t.voFrom + Math.round((i / shown.length) * t.voDur);
};

// Кадр для i-го из n элементов без явной привязки: равномерно по тексту
export const spreadFrame = (t: SegTiming, i: number, n: number) => t.voFrom + Math.round(t.voDur * (0.1 + (0.75 * i) / Math.max(1, n)));

// Для сцены: at(фраза) — кадр фразы; at(undefined, i, n) — равномерно; min — не раньше этого кадра
export const timeAt = (t: SegTiming, vo: string, min = 0) => (anchor: string | undefined, i = 0, n = 1) =>
  Math.max(min, anchor ? anchorFrame(t, vo, anchor) : spreadFrame(t, i, n));

// Кадр, когда итоговая таблица финала перелистывается на конечную заставку (чуть раньше фразы recap.to)
export const recapTurn = (seg: OutroSeg, t: SegTiming) => (seg.recap ? timeAt(t, seg.vo, 30)(seg.recap.to) - 6 : 0);

// ── Субтитры: куски до двух строк по ~42 знака, разрыв по смыслу, без висящих слов ──
const LINE = 42;
const MAX_SUB = LINE * 2;
const MIN_SUB = 26; // короче — склеиваем с соседом

// Цена разрыва перед пробелом i: ближе к цели — лучше; после знака препинания или перед тире — лучше;
// предлог или союз (слово до двух букв) не оставляем висеть в конце строки
const breakScore = (s: string, i: number, target: number, punctBonus: number) => {
  const prevWord = s.slice(0, i).split(' ').pop() ?? '';
  const punct = /[,;:]$/.test(prevWord) || s[i + 1] === '—';
  const dangling = prevWord.replace(/[«»"()]/g, '').length <= 2 && !/[,;:.!?—]$/.test(prevWord);
  return Math.abs(i - target) - (punct ? punctBonus : 0) + (dangling ? 30 : 0);
};

// Длинное предложение → k почти равных кусков; разрыв ищем у знака препинания, иначе у пробела
const splitLong = (s: string): string[] => {
  const k = Math.ceil(s.length / MAX_SUB);
  if (k <= 1) return [s];
  const cuts: number[] = [];
  let from = 0;
  for (let n = 1; n < k; n++) {
    const target = Math.round((s.length * n) / k);
    let best = -1;
    let bestScore = Infinity;
    for (let i = from + 10; i < s.length - 10; i++) {
      if (s[i] !== ' ') continue;
      const score = breakScore(s, i, target, 16);
      if (i - from <= MAX_SUB && score < bestScore) (bestScore = score), (best = i);
    }
    if (best < 0) break;
    cuts.push(best);
    from = best + 1;
  }
  const out: string[] = [];
  let a = 0;
  for (const c of cuts) out.push(s.slice(a, c).trim()), (a = c + 1);
  out.push(s.slice(a).trim());
  return out.flatMap((p) => (p.length > MAX_SUB ? splitLong(p) : [p]));
};

// Текст диктора → куски субтитров: по предложениям, длинные — на равные части, короткие — к соседу
export const splitSubs = (vo: string): string[] => {
  const pieces = stripTags(vo)
    .split(/(?<=[.!?…])\s+/)
    .flatMap((s) => (s.length > MAX_SUB ? splitLong(s) : [s]))
    .filter(Boolean);
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i].length >= MIN_SUB) continue;
    const prev = i > 0 ? pieces[i - 1] : null;
    const next = i < pieces.length - 1 ? pieces[i + 1] : null;
    const withPrev = prev !== null && prev.length + 1 + pieces[i].length <= MAX_SUB;
    const withNext = next !== null && next.length + 1 + pieces[i].length <= MAX_SUB;
    if (withPrev && (!withNext || prev!.length <= next!.length)) {
      pieces.splice(i - 1, 2, `${prev} ${pieces[i]}`);
      i -= 2;
    } else if (withNext) {
      pieces.splice(i, 2, `${pieces[i]} ${next}`);
      i -= 1;
    }
  }
  return pieces;
};

// Кусок субтитра → две строки примерно равной длины (разрыв у пробела ближе к середине, лучше после знака препинания)
export const twoLines = (text: string) => {
  if (text.length <= LINE) return text;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    if (text[i] !== ' ') continue;
    const score = breakScore(text, i, text.length / 2, 12);
    if (Math.max(i, text.length - i - 1) <= LINE + 8 && score < bestScore) (bestScore = score), (best = i);
  }
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
};

// Субтитры сегмента (кадры внутри сегмента). С записью — по времени первого и последнего символа куска
export const buildSubs = (vo: string, voFrom: number, voDur: number, times?: SegTiming['times']): Sub[] => {
  const shown = stripTags(vo);
  const chunks = splitSubs(vo);
  let cursor = 0;
  const spans = chunks.map((text) => {
    const a = Math.max(cursor, shown.indexOf(text, cursor));
    cursor = a + text.length;
    return {text, a, b: cursor};
  });
  return spans.map(({text, a, b}, i) => {
    if (times) {
      const from = voFrom + Math.round(times.start[a] * FPS);
      const next = spans[i + 1];
      const to = next ? voFrom + Math.round(times.start[next.a] * FPS) : voFrom + Math.round(times.end[b - 1] * FPS) + 12;
      return {from, to, text: twoLines(text)};
    }
    return {from: voFrom + Math.round((a / shown.length) * voDur), to: voFrom + Math.round((b / shown.length) * voDur), text: twoLines(text)};
  });
};
