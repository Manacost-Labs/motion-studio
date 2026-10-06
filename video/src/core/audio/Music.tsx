// Музыка ролика под голос: треки по кругу с перекрёстным затуханием XFADE; под голосом приглушается,
// в паузах диктора от 1 с мягко поднимается (между сценами — до полной, внутри сцены — наполовину),
// к концу ролика уходит в тишину. Всё время — в «кадрах-30» (core/time/fps.ts)
import React from 'react';
import {Html5Audio, interpolate, Sequence, staticFile} from 'remotion';
import {BASE_FPS, useK} from '../time/fps';
import {clamp} from '../time/ease';
import {VoTimes} from '../voice/timing';

export const XFADE = 45; // перекрёстное затухание музыки между треками
const MUSIC_VOL = 0.45; // музыка без голоса
const MUSIC_DUCK = 0.3; // во сколько раз тише под голосом

export type MusicCue = {src: string; from: number; dur: number};
// Сегмент для расчёта речи: начало и длина (кадры-30 от начала ролика), голос внутри сегмента и время символов записи
export type SpeechSeg = {from: number; dur: number; voFrom: number; voDur: number; voice: string | null; times?: VoTimes};
export type MusicTiming = {segments: SpeechSeg[]; music: MusicCue[]; total: number};

// Где диктор говорит (кадры-30 от начала ролика): по времени символов из <сцена>.json, паузы короче GAP — внутри речи.
// Без json — вся запись сцены
const GAP = 30; // пауза от 1 с — музыке можно чуть подняться
const speechOf = (segments: SpeechSeg[]) => {
  const out: [number, number][] = [];
  for (const s of segments) {
    if (!s.voice) continue;
    const at = (sec: number) => s.from + s.voFrom + sec * BASE_FPS;
    const t = s.times;
    if (!t) {
      out.push([s.from + s.voFrom, s.from + s.voFrom + s.voDur]);
      continue;
    }
    for (let i = 0; i < t.start.length; i++) {
      if (!(t.end[i] > t.start[i])) continue;
      const [a, b] = [at(t.start[i]), at(t.end[i])];
      const last = out[out.length - 1];
      if (last && a - last[1] < GAP && last[0] >= s.from) last[1] = Math.max(last[1], b);
      else out.push([a, b]);
    }
  }
  return out;
};

export const Music: React.FC<{timing: MusicTiming}> = ({timing}) => {
  const K = useK();
  const speech = React.useMemo(() => speechOf(timing.segments), [timing]);
  const PRE = 6; // приглушиться за 0,2 с до слова
  const POST = 9; // и держать 0,3 с после
  const DOWN = 9; // спуск, кадров-30
  const UP = 24; // подъём — медленнее спуска, чтобы не «качало»
  const duck = (g: number) => {
    let k = speech.findIndex(([a]) => a - PRE > g); // следующий кусок речи
    if (k < 0) k = speech.length;
    const prev = speech[k - 1];
    const next = speech[k];
    if (prev && g <= prev[1] + POST) return MUSIC_DUCK;
    const seg = timing.segments.find((s) => g >= s.from && g < s.from + s.dur);
    const inside = !!seg?.voice && g >= seg.from + seg.voFrom && g < seg.from + seg.voFrom + seg.voDur; // пауза внутри записи сцены
    const top = inside ? MUSIC_DUCK + (1 - MUSIC_DUCK) * 0.5 : 1;
    const up = prev ? interpolate(g - prev[1] - POST, [0, UP], [0, 1], clamp) : 1;
    const down = next ? interpolate(next[0] - PRE - g, [0, DOWN], [0, 1], clamp) : 1;
    const e = Math.min(up, down);
    return MUSIC_DUCK + (top - MUSIC_DUCK) * e * e * (3 - 2 * e);
  };
  return (
    <>
      {timing.music.map((m, i) => (
        <Sequence key={i} from={Math.round(m.from * K)} durationInFrames={Math.round(m.dur * K)} layout="none">
          <Html5Audio
            src={staticFile(m.src)}
            volume={(real) => {
              const f = real / K;
              return (
              MUSIC_VOL *
              interpolate(f, [0, XFADE, m.dur - XFADE, m.dur], [i === 0 ? 1 : 0, 1, 1, 0], clamp) *
              duck(m.from + f) *
              interpolate(m.from + f, [timing.total - 90, timing.total], [1, 0], clamp)
              );
            }}
          />
        </Sequence>
      ))}
    </>
  );
};
