// Хронометраж ролика под голос (calculateMetadata): длина каждой сцены — по записи голоса или по оценке текста,
// паузы и наименьшие длины — из реестра сцен канала (SceneDef), музыка по кругу. Всё — в «кадрах-30» (core/time/fps.ts).
// Голос: public/vo/<config.id>/<сегмент>.mp3 (или .wav/.m4a). Есть файл — сцена длится по записи; нет — по тексту (CPS).
import {CalculateMetadataFunction, staticFile} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {BASE_FPS} from '../time/fps';
import {XFADE} from '../audio/Music';
import {buildSubs, estimateVo, stripTags} from './timing';
import {sceneOf, SceneDef} from '../video/registry';
import type {BaseSeg, SegTiming, VoicedConfig, VoicedProps, VoicedTiming} from '../video/types';

// Умолчания сцены (SceneDef их переопределяет)
export const LEAD = 10; // кадров до начала голоса
export const TAIL = 14; // кадров после голоса
export const MIN = 150; // наименьшая длина сцены

const pick = <S extends BaseSeg>(v: number | ((seg: S) => number) | undefined, seg: S, dflt: number) => (v === undefined ? dflt : typeof v === 'function' ? v(seg) : v);
export const leadOf = <S extends BaseSeg>(def: SceneDef<S, any>, seg: S) => pick(def.lead, seg, LEAD);
export const tailOf = <S extends BaseSeg>(def: SceneDef<S, any>, seg: S) => pick(def.tail, seg, TAIL);
export const minOf = <S extends BaseSeg>(def: SceneDef<S, any>, seg: S) => pick(def.min, seg, MIN);

// Название главы для описания YouTube: своё chapter сегмента важнее правила сцены (как было в шаблоне). Сцена без своей
// главы (chapter: false) даёт '' — входит в следующую главу: глава YouTube короче 10 с ломает весь список, а первая
// обязана начинаться с 0:00
export const chapterOf = <S extends BaseSeg>(def: SceneDef<S, any>, seg: S): string =>
  seg.chapter ?? (def.chapter === false ? '' : typeof def.chapter === 'function' ? def.chapter(seg) : def.chapter ?? (seg as {title?: string}).title ?? seg.kind);

const probe = async (path: string): Promise<number | null> => {
  const src = staticFile(path);
  try {
    const r = await fetch(src, {method: 'HEAD'});
    if (!r.ok) return null;
    return await getAudioDurationInSeconds(src);
  } catch {
    return null;
  }
};

// calculateMetadata для композиции канала: calcVoiced(channel)
export const calcVoiced =
  <P extends VoicedProps<VoicedConfig<any>>>(channel: {byKind: Record<string, SceneDef<any, any>>}): CalculateMetadataFunction<P> =>
  async ({props}) => {
    const {config} = props;
    const segments: (SegTiming & {chapter: string})[] = [];
    let from = 0;
    for (const s of config.segments) {
      const def = sceneOf(channel, s.kind);
      let voice: string | null = null;
      let sec: number | null = null;
      for (const ext of s.vo.trim() ? ['mp3', 'wav', 'm4a'] : []) { // сцена без текста (разделитель) — голос не ищем
        const p = `vo/${config.id}/${s.id}.${ext}`;
        sec = await probe(p);
        if (sec) {
          voice = p;
          break;
        }
      }
      const voDur = sec ? Math.ceil(sec * BASE_FPS) : estimateVo(s.vo);
      // время каждого символа из <сегмент>.json (scripts/tts.mjs или vo-align.mjs) — если текст с записи не менялся
      let times: SegTiming['times'];
      if (voice) {
        const meta = await fetch(staticFile(`vo/${config.id}/${s.id}.json`))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (meta?.text === stripTags(s.vo)) times = {start: meta.start, end: meta.end};
        else if (meta) console.warn(`Текст сегмента «${s.id}» изменился после записи голоса — привязки по доле текста. Перезапишите голос.`);
      }
      const lead = leadOf(def, s);
      const dur = Math.max(minOf(def, s), lead + voDur + tailOf(def, s));
      segments.push({id: s.id, chapter: chapterOf(def, s), from, dur, voFrom: lead, voDur, voice, subs: buildSubs(s.vo, lead, voDur, times), times});
      from += dur;
    }
    const total = from;
    const lens = await Promise.all(config.music.map(async (m: string) => Math.floor((await getAudioDurationInSeconds(staticFile(m))) * BASE_FPS)));
    const music = [];
    // без музыки (новое направление до выбора треков) — только голос и звуки
    for (let t = 0, k = 0; lens.length && t < total; k++) {
      const i = k % lens.length;
      music.push({src: config.music[i], from: t, dur: lens[i]});
      t += lens[i] - XFADE;
    }
    // всё выше — в «кадрах-30» (fps.ts); ролик может рендериться в 60 к/с — тогда кадров вдвое больше
    // черновик (render.ps1 -Draft → REMOTION_DRAFT): 30 к/с для быстрых проб; тайминги в «кадрах-30» от этого не меняются
    const fps = process.env.REMOTION_DRAFT ? BASE_FPS : config.fps ?? BASE_FPS;
    const timing: VoicedTiming = {segments, music, total, base: BASE_FPS};
    return {durationInFrames: Math.round(total * (fps / BASE_FPS)), fps, props: {...props, timing}};
  };
