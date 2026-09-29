// Сборка ролика из сцен: сцены идут встык, на каждом стыке — вспышка с пульсом и удар сердца
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {C} from './theme';
import {BrandBug, SceneFade} from './components';
import {PulseCut} from './scenes';
import {Cue, MusicSpec, SFX, Soundtrack} from './audio';

export type SpotScene = {id: string; dur: number; render: (dur: number) => React.ReactNode};

export const timeline = (scenes: {id: string; dur: number}[]) => {
  const start: Record<string, number> = {};
  let t = 0;
  for (const s of scenes) {
    start[s.id] = t;
    t += s.dur;
  }
  return {start, total: t};
};

// Удары сердца на стыках сцен (кроме самого первого — там обычно логотип со своим ударом)
export const cutCues = (scenes: {id: string; dur: number}[], skip: string[] = []): Cue[] => {
  const {start} = timeline(scenes);
  return scenes.slice(1).filter((s) => !skip.includes(s.id)).map((s): Cue => [SFX.heartbeat, start[s.id] - 2, 0.4]);
};

// bug: [с какой сцены, до какой] показывать маленький логотип сверху — одним куском, без мигания на стыках
export const Spot: React.FC<{scenes: SpotScene[]; cues?: Cue[]; music?: MusicSpec; bug?: [string, string]}> = ({scenes, cues = [], music, bug}) => {
  const {start} = timeline(scenes);
  return (
    <AbsoluteFill style={{background: C.night}}>
      {scenes.map((s, i) => (
        <Sequence key={s.id} from={start[s.id]} durationInFrames={s.dur}>
          <SceneFade dur={s.dur} fadeIn={i > 0} fadeOut={i < scenes.length - 1}>
            {s.render(s.dur)}
          </SceneFade>
        </Sequence>
      ))}
      {bug && (
        <Sequence from={start[bug[0]]} durationInFrames={start[bug[1]] - start[bug[0]]}>
          <BrandBug />
        </Sequence>
      )}
      {scenes.slice(1).map((s) => (
        <Sequence key={`cut-${s.id}`} from={start[s.id] - 8} durationInFrames={16}>
          <PulseCut />
        </Sequence>
      ))}
      <Soundtrack cues={cues} music={music} />
    </AbsoluteFill>
  );
};
