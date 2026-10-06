// Движок «ролик под голос» (16:9): сцены по реестру канала (core/video/registry.ts), каждая — в своей Sequence
// с переходом стиля (look.Frame) и перекрытием на стыке; голос сцены, субтитры (там, где ещё нет записи — режим auto),
// звук стыка, музыка с приглушением под речь и фон-атмосфера. Хронометраж — calcVoiced (core/voice/calc.ts).
import React from 'react';
import {AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {BASE_FPS, FrameScale} from '../time/fps';
import {Ambience} from '../audio/Ambience';
import {Music} from '../audio/Music';
import {Sfx} from '../audio/Sfx';
import {LintProbe} from '../qa/lint';
import {Channel, sceneOf} from './registry';
import type {SegTiming, VoicedConfig, VoicedTiming} from './types';

export const VoicedVideo: React.FC<{config: VoicedConfig<any>; timing?: VoicedTiming; channel: Channel}> = ({config, timing, channel}) => {
  if (!timing) return null;
  const {look} = channel;
  const n = config.segments.length;
  const mode = config.subtitles ?? 'auto';
  const subsOn = (t: SegTiming) => mode === 'on' || (mode === 'auto' && !t.voice);
  const ctx = channel.context(config.segments);
  // настоящая частота композиции, а не config.fps: черновик (REMOTION_DRAFT) идёт в 30 к/с при config.fps = 60
  const K = useVideoConfig().fps / BASE_FPS;
  return (
    <FrameScale value={K}>
    <AbsoluteFill>
      <look.Backdrop />
      {config.segments.map((s, i) => {
        const t = timing.segments[i];
        const def = sceneOf(channel, s.kind);
        const zone = def.subtitleZone ?? look.subtitles;
        const last = i === n - 1;
        // стык: уходящая сцена живёт ещё look.overlap кадров поверх входа следующей (переход — look.Frame)
        return (
          <Sequence key={s.id} from={Math.round(t.from * K)} durationInFrames={Math.round((t.dur + (last ? 0 : look.overlap)) * K)} name={s.id}>
            <look.Frame i={i} dur={t.dur} first={i === 0} last={last} ctx={ctx}>
              <def.Component seg={s} t={t} subs={subsOn(t)} ctx={ctx} />
              {subsOn(t) && <look.Subtitles subs={t.subs} cx={zone.cx} bottom={look.subtitles.bottom} maxW={zone.maxW} />}
            </look.Frame>
            {t.voice && (
              <Sequence from={Math.round(t.voFrom * K)} layout="none">
                <Html5Audio src={staticFile(t.voice)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      {look.cut && timing.segments.slice(1).map((t) => <Sfx key={`cut-${t.id}`} file={look.cut!.file} at={t.from - look.cut!.before} volume={look.cut!.volume} />)}
      {look.Overlay && <look.Overlay />}
      <Music timing={timing} />
      {config.ambience?.length ? <Ambience timing={timing} layers={config.ambience} /> : null}
      {/* проверка раскладки (scripts/yt-lint.mjs) — только при её рендере */}
      {process.env.REMOTION_LINT ? <LintProbe /> : null}
      {/* черновик (render.ps1 -Draft): id сцены и время — отзыв на фрагмент сразу с адресом; в чистовом и эталонах её нет */}
      {process.env.REMOTION_DRAFT ? <DraftStamp timing={timing} /> : null}
    </AbsoluteFill>
    </FrameScale>
  );
};

// Плашка черновика в правом верхнем углу: «deck-07 · 3:12.4» (время ролика, а не кадр: в черновике 30 к/с, в чистовом 60)
const DraftStamp: React.FC<{timing: VoicedTiming}> = ({timing}) => {
  const {fps} = useVideoConfig();
  const s = useCurrentFrame() / fps;
  const g = s * BASE_FPS;
  const seg = [...timing.segments].reverse().find((t) => g >= t.from) ?? timing.segments[0];
  const time = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`;
  return (
    <div style={{position: 'absolute', right: 14, top: 12, padding: '3px 9px', borderRadius: 4, background: 'rgba(0,0,0,0.62)', color: '#fff', fontFamily: 'Consolas, monospace', fontSize: 20, letterSpacing: '0.02em'}}>
      {seg.id} · {time}
    </div>
  );
};
