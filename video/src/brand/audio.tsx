// Звуковая библиотека бренда: музыка и эффекты лежат в public/audio (обрезаны и нормализованы)
import React from 'react';
import {Html5Audio, interpolate, Sequence, staticFile} from 'remotion';

export const SFX = {
  whoosh: 'sfx-whoosh.wav', // полёт карт, прокрутка, смена слайда
  heartbeat: 'sfx-heartbeat.wav', // удар пульса: логотип и переходы между сценами
  pop: 'sfx-pop.wav', // появление панели интерфейса
  flip: 'sfx-flip.wav', // переворот карты
  impact: 'sfx-impact.wav', // финальный удар на заставке
} as const;

export type Cue = [file: string, frame: number, volume: number];

export type MusicSpec = {file: string; start: number; fadeEnd: number; volume?: number};

// В music.m4a сильная доля приходится на 2,5 с, трек затухает к ~27 с.
// Сдвигаем его так, чтобы доля совпала с появлением логотипа, и уводим в ноль к финальному удару.
export const brandMusic = (logoStart: number, endStart: number): MusicSpec => ({
  file: 'music.m4a',
  start: logoStart - 75,
  fadeEnd: endStart + 12,
});

// Файл из public/audio ('sfx-pop.wav') или из библиотеки ('lib/sfx/coin-single.wav')
const audioSrc = (file: string) => staticFile(file.startsWith('lib/') ? file : `audio/${file}`);

export const Soundtrack: React.FC<{cues: Cue[]; music?: MusicSpec}> = ({cues, music}) => (
  <>
    {music && (
      <Sequence from={music.start}>
        <Html5Audio
          src={audioSrc(music.file)}
          volume={(f) =>
            (music.volume ?? 0.8) *
            interpolate(f, [0, 6, music.fadeEnd - music.start - 20, music.fadeEnd - music.start], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      </Sequence>
    )}
    {cues.map(([file, frame, volume], i) => (
      <Sequence key={i} from={Math.max(0, frame)} durationInFrames={120}>
        <Html5Audio src={audioSrc(file)} volume={volume} />
      </Sequence>
    ))}
  </>
);
