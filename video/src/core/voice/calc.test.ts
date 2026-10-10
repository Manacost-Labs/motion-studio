// Хронометраж ролика (calcVoiced): длины сцен по записи или по тексту, паузы и главы из SceneDef, музыка по кругу,
// частота кадров. Браузерное (staticFile, fetch, длина аудио) подменено: файлы голоса и музыки — словарь ниже
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const audio: Record<string, number> = {}; // путь в public → длина, с
const json: Record<string, unknown> = {}; // путь в public → содержимое .json записи
vi.mock('remotion', async (orig) => ({...(await orig<typeof import('remotion')>()), staticFile: (p: string) => `/${p}`}));
vi.mock('@remotion/media-utils', () => ({
  getAudioDurationInSeconds: vi.fn(async (src: string) => {
    const sec = audio[src.slice(1)];
    if (sec === undefined) throw new Error(`нет файла ${src}`);
    return sec;
  }),
}));

import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {calcVoiced, chapterOf, LEAD, MIN, TAIL} from './calc';
import {estimateVo, stripTags} from './timing';
import {defineChannel, defineScene} from '../video/registry';
import {XFADE} from '../audio/Music';
import type {VoicedConfig} from '../video/types';

const Noop = () => null;
type Seg = {id: string; kind: string; vo: string; chapter?: string; title?: string};
const plain = defineScene<Seg>({kind: 'plain', Component: Noop});
const custom = defineScene<Seg>({kind: 'custom', Component: Noop, lead: 20, tail: (s) => (s.id === 'c2' ? 40 : 5), min: 30, chapter: false});
const channel = defineChannel({look: {} as any, brand: 'b', game: null, context: () => ({}), fields: {}, scenes: [plain, custom]});

const run = async (config: VoicedConfig<Seg>) => {
  const res = await calcVoiced(channel)({props: {config}, defaultProps: {config}, abortSignal: new AbortController().signal, compositionId: 'x', isRendering: false} as any);
  return res as {durationInFrames: number; fps: number; props: {timing: any}};
};

beforeEach(() => {
  for (const k of Object.keys(audio)) delete audio[k];
  for (const k of Object.keys(json)) delete json[k];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: {method?: string}) => {
      const p = url.slice(1);
      if (init?.method === 'HEAD') return {ok: p in audio};
      return p in json ? {ok: true, json: async () => json[p]} : {ok: false};
    }),
  );
  vi.mocked(getAudioDurationInSeconds).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.REMOTION_DRAFT;
});

const VO1 = 'Первое место — Дракон Воин. Игрокам понадобилось время, чтобы понять.';

describe('calcVoiced', () => {
  it('без записи: длина по тексту, паузы по умолчанию, сцены встык, без музыки — пустой список', async () => {
    const long = VO1.repeat(4);
    const {props, durationInFrames, fps} = await run({id: 'v', music: [], segments: [
      {id: 'a', kind: 'plain', vo: VO1},
      {id: 'b', kind: 'plain', vo: long},
    ]});
    const [a, b] = props.timing.segments;
    expect(a).toMatchObject({from: 0, voFrom: LEAD, voDur: estimateVo(VO1), voice: null, dur: Math.max(MIN, LEAD + estimateVo(VO1) + TAIL)});
    expect(b.from).toBe(a.dur);
    expect(b.dur).toBe(LEAD + estimateVo(long) + TAIL);
    expect(props.timing.total).toBe(a.dur + b.dur);
    expect(props.timing.music).toEqual([]);
    expect(getAudioDurationInSeconds).not.toHaveBeenCalled();
    expect(fps).toBe(30);
    expect(durationInFrames).toBe(props.timing.total);
  });

  it('сцена без текста (разделитель): голос не ищется, длина — наименьшая', async () => {
    const {props} = await run({id: 'v', music: [], segments: [{id: 'd', kind: 'plain', vo: ''}]});
    expect(props.timing.segments[0]).toMatchObject({voDur: 0, voice: null, dur: MIN, subs: []});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('паузы, наименьшая длина и глава — из SceneDef (числа и функции)', async () => {
    const {props} = await run({id: 'v', music: [], segments: [
      {id: 'c1', kind: 'custom', vo: 'Раз.'},
      {id: 'c2', kind: 'custom', vo: VO1},
    ]});
    const [c1, c2] = props.timing.segments;
    expect(c1).toMatchObject({voFrom: 20, dur: Math.max(30, 20 + estimateVo('Раз.') + 5), chapter: ''});
    expect(c2.dur).toBe(20 + estimateVo(VO1) + 40);
  });

  it('запись есть: длина по файлу, время символов из .json, если текст не менялся', async () => {
    audio['vo/v/a.mp3'] = 4.2;
    json['vo/v/a.json'] = {text: stripTags(VO1), start: [0, 0.1], end: [0.1, 0.2]};
    audio['vo/v/b.wav'] = 2;
    json['vo/v/b.json'] = {text: 'старый текст', start: [], end: []};
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {props} = await run({id: 'v', music: [], segments: [
      {id: 'a', kind: 'plain', vo: VO1},
      {id: 'b', kind: 'plain', vo: VO1},
    ]});
    const [a, b] = props.timing.segments;
    expect(a).toMatchObject({voice: 'vo/v/a.mp3', voDur: Math.ceil(4.2 * 30), times: {start: [0, 0.1], end: [0.1, 0.2]}});
    expect(b).toMatchObject({voice: 'vo/v/b.wav', voDur: 60});
    expect(b.times).toBeUndefined(); // текст изменился после записи — привязки по доле текста
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('«b»'));
    warn.mockRestore();
  });

  it('музыка по кругу с перекрёстным затуханием покрывает весь ролик', async () => {
    audio['m1.mp3'] = 10;
    audio['m2.mp3'] = 5;
    const {props} = await run({id: 'v', music: ['m1.mp3', 'm2.mp3'], segments: [{id: 'a', kind: 'plain', vo: VO1.repeat(20)}]});
    const {music, total} = props.timing;
    expect(music[0]).toEqual({src: 'm1.mp3', from: 0, dur: 300});
    expect(music[1]).toEqual({src: 'm2.mp3', from: 300 - XFADE, dur: 150});
    expect(music[2].src).toBe('m1.mp3');
    const last = music.at(-1);
    expect(last.from).toBeLessThan(total);
    expect(last.from + last.dur).toBeGreaterThanOrEqual(total);
  });

  it('частота: config.fps = 60 — кадров вдвое больше; черновик (REMOTION_DRAFT) — 30', async () => {
    const config: VoicedConfig<Seg> = {id: 'v', music: [], fps: 60, segments: [{id: 'a', kind: 'plain', vo: VO1}]};
    const full = await run(config);
    expect(full.fps).toBe(60);
    expect(full.durationInFrames).toBe(full.props.timing.total * 2);
    expect(full.props.timing.base).toBe(30);
    process.env.REMOTION_DRAFT = '1';
    const draft = await run(config);
    expect(draft.fps).toBe(30);
    expect(draft.durationInFrames).toBe(draft.props.timing.total);
  });

  it('вид сцены не из канала — ошибка', async () => {
    await expect(run({id: 'v', music: [], segments: [{id: 'x', kind: 'nope', vo: ''}]})).rejects.toThrow(/nope/);
  });
});

describe('chapterOf', () => {
  const titled = defineScene<Seg>({kind: 't', Component: Noop});
  const named = defineScene<Seg>({kind: 'n', Component: Noop, chapter: 'Колода'});
  const byFn = defineScene<Seg>({kind: 'f', Component: Noop, chapter: (s) => `Глава ${s.id}`});
  it('своя глава сегмента важнее правила сцены', () => {
    expect(chapterOf(custom, {id: 'a', kind: 'custom', vo: '', chapter: 'Своя'})).toBe('Своя');
  });
  it('chapter: false — пусто (входит в следующую), строка, функция, иначе title, иначе вид', () => {
    expect(chapterOf(custom, {id: 'a', kind: 'custom', vo: ''})).toBe('');
    expect(chapterOf(named, {id: 'a', kind: 'n', vo: ''})).toBe('Колода');
    expect(chapterOf(byFn, {id: '7', kind: 'f', vo: ''})).toBe('Глава 7');
    expect(chapterOf(titled, {id: 'a', kind: 't', vo: '', title: 'Заголовок'})).toBe('Заголовок');
    expect(chapterOf(titled, {id: 'a', kind: 't', vo: ''})).toBe('t');
  });
});
