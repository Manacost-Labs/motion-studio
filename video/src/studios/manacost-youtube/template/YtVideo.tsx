// Шаблон «YouTube-ролик Манакоста» (16:9, под озвучку): подборки, гайды на колоды, обзоры.
// Ролик = конфиг (src/studios/manacost-youtube/<папка>/config.ts) — список сцен любого вида (scenes/index.tsx), у каждой текст диктора vo.
// Голос: public/vo/<config.id>/<сегмент>.mp3 (или .wav/.m4a). Есть файл — сцена длится по записи,
// субтитры в режиме auto скрываются, музыка приглушается. Нет файла — длина по тексту (CPS в timing.ts).
import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction, Composition, Html5Audio, Img, interpolate, Sequence, staticFile, Still, useCurrentFrame} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {DISPLAY, FPS, MANACOST} from '../brand';
import {Grain, hsRender, Page, Sfx, Subtitles, Vignette} from './parts';
import {chapterOf, Scene, subtitleZone} from './scenes';
import {H, parchmentBg, redBg, TEXT} from './theme';
import {buildSubs, estimateVo, leadFor, minFor, stripTags, tailFor, XFADE} from './timing';
import {SegTiming, YtConfig, YtProps, YtTiming} from './types';

const MUSIC_VOL = 0.45; // музыка без голоса
const MUSIC_DUCK = 0.3; // во сколько раз тише под голосом
const DIP = 8; // кадров на уход сцены и появление следующей (склейка проходит через чистый пергамент)

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

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

export const calcYt: CalculateMetadataFunction<YtProps> = async ({props}) => {
  const {config} = props;
  const segments: (SegTiming & {chapter: string})[] = [];
  let from = 0;
  for (const s of config.segments) {
    let voice: string | null = null;
    let sec: number | null = null;
    for (const ext of ['mp3', 'wav', 'm4a']) {
      const p = `vo/${config.id}/${s.id}.${ext}`;
      sec = await probe(p);
      if (sec) {
        voice = p;
        break;
      }
    }
    const voDur = sec ? Math.ceil(sec * FPS) : estimateVo(s.vo);
    // время каждого символа из <сегмент>.json (scripts/tts.mjs или vo-align.mjs) — если текст с записи не менялся
    let times: SegTiming['times'];
    if (voice) {
      const meta = await fetch(staticFile(`vo/${config.id}/${s.id}.json`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (meta?.text === stripTags(s.vo)) times = {start: meta.start, end: meta.end};
      else if (meta) console.warn(`Текст сегмента «${s.id}» изменился после записи голоса — привязки по доле текста. Перезапишите голос.`);
    }
    const lead = leadFor(s);
    const dur = Math.max(minFor(s), lead + voDur + tailFor(s));
    segments.push({id: s.id, chapter: chapterOf(s), from, dur, voFrom: lead, voDur, voice, subs: buildSubs(s.vo, lead, voDur, times), times});
    from += dur;
  }
  const total = from;
  const lens = await Promise.all(config.music.map(async (m) => Math.floor((await getAudioDurationInSeconds(staticFile(m))) * FPS)));
  const music = [];
  for (let t = 0, k = 0; t < total; k++) {
    const i = k % lens.length;
    music.push({src: config.music[i], from: t, dur: lens[i]});
    t += lens[i] - XFADE;
  }
  const timing: YtTiming = {segments, music, total};
  return {durationInFrames: total, props: {...props, timing}};
};

// Стык сцен: короткое растворение в чистый пергамент (фон всего ролика)
const SegFade: React.FC<{dur: number; first: boolean; last: boolean; children: React.ReactNode}> = ({dur, first, last, children}) => {
  const f = useCurrentFrame();
  const o = Math.min(first ? 1 : interpolate(f, [0, DIP], [0, 1], clamp), last ? 1 : interpolate(f, [dur - DIP, dur], [1, 0], clamp));
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

// Музыка по кругу; под голосом приглушается, к концу ролика уходит в тишину
const Music: React.FC<{timing: YtTiming}> = ({timing}) => {
  const raw = (g: number) => (timing.segments.find((s) => g >= s.from && g < s.from + s.dur)?.voice ? MUSIC_DUCK : 1);
  const duck = (g: number) => {
    const b = timing.segments.map((s) => s.from).find((x) => Math.abs(g - x) < 15);
    return b === undefined ? raw(g) : interpolate(g, [b - 15, b + 15], [raw(b - 1), raw(b)], clamp);
  };
  return (
    <>
      {timing.music.map((m, i) => (
        <Sequence key={i} from={m.from} durationInFrames={m.dur} layout="none">
          <Html5Audio
            src={staticFile(m.src)}
            volume={(f) =>
              MUSIC_VOL *
              interpolate(f, [0, XFADE, m.dur - XFADE, m.dur], [i === 0 ? 1 : 0, 1, 1, 0], clamp) *
              duck(m.from + f) *
              interpolate(m.from + f, [timing.total - 90, timing.total], [1, 0], clamp)
            }
          />
        </Sequence>
      ))}
    </>
  );
};

export const YtVideo: React.FC<YtProps> = ({config, timing}) => {
  if (!timing) return null;
  const n = config.segments.length;
  const mode = config.subtitles ?? 'auto';
  const subsOn = (t: SegTiming) => mode === 'on' || (mode === 'auto' && !t.voice);
  const ranks = config.segments.flatMap((s) => (s.kind === 'deck' && s.rank !== undefined ? [s.rank] : []));
  const rankOf = ranks.length > 1 ? Math.max(...ranks) : undefined;
  return (
    <AbsoluteFill>
      <Page />
      {config.segments.map((s, i) => {
        const t = timing.segments[i];
        const zone = subtitleZone(s);
        return (
          <Sequence key={s.id} from={t.from} durationInFrames={t.dur} name={s.id}>
            <SegFade dur={t.dur} first={i === 0} last={i === n - 1}>
              <Scene seg={s} t={t} rankOf={rankOf} subs={subsOn(t)} />
              {subsOn(t) && <Subtitles subs={t.subs} cx={zone.cx} bottom={26} maxW={zone.maxW} />}
            </SegFade>
            {t.voice && (
              <Sequence from={t.voFrom} layout="none">
                <Html5Audio src={staticFile(t.voice)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      {timing.segments.slice(1).map((t) => (
        <Sfx key={`cut-${t.id}`} file="lib/sfx/magic-whoosh.wav" at={t.from - 5} volume={0.12} />
      ))}
      <Vignette />
      <Grain />
      <Music timing={timing} />
    </AbsoluteFill>
  );
};

// ─── Обложка 1280×720 «Компендиум»: слева красное сукно с заголовком, справа пергамент и три карты веером.
// Веер держится левее правого нижнего угла — там YouTube рисует плашку длительности. hook — сургучная печать ───
export const YtThumb: React.FC<{config: YtConfig}> = ({config}) => {
  const {thumb} = config;
  const H0 = 520; // высота карты
  const fan = [
    {x: 862, y: 138, r: -11},
    {x: 1072, y: 128, r: 8},
    {x: 968, y: 84, r: -1},
  ];
  return (
    <AbsoluteFill style={parchmentBg}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 700, height: 720, ...redBg}} />
      <div style={{position: 'absolute', left: 700, top: 0, width: 8, height: 720, background: `linear-gradient(90deg, ${H.woodSoft}, ${H.wood})`}} />
      {thumb.cards.slice(0, 3).map((id, i) => (
        <Img
          key={id}
          src={hsRender(id)}
          style={{position: 'absolute', left: fan[i].x - (H0 * 512) / 776 / 2, top: fan[i].y, height: H0, rotate: `${fan[i].r}deg`, filter: 'drop-shadow(0 22px 22px rgba(60,25,10,0.45))'}}
        />
      ))}
      {thumb.hook && (
        <div
          style={{
            position: 'absolute',
            left: 700 + 26,
            top: 452,
            width: 176,
            height: 176,
            borderRadius: '50%',
            rotate: '-8deg',
            background: 'radial-gradient(circle at 38% 32%, #b3262c, #7a1015 62%, #4d0a0e)',
            boxShadow: `0 0 0 6px ${H.gold}, 0 0 0 9px ${H.wood}, 0 16px 26px rgba(40,5,8,0.5)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: DISPLAY,
            fontSize: 66,
            color: H.goldBright,
            textShadow: '0 3px 0 rgba(40,5,8,0.8)',
          }}
        >
          {thumb.hook}
        </div>
      )}
      <div style={{position: 'absolute', left: 56, top: 64}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, fontFamily: TEXT, fontWeight: 800, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase', color: H.goldBright}}>
          <span style={{width: 12, height: 12, rotate: '45deg', background: H.goldBright}} />
          {thumb.badge}
        </div>
        <div style={{fontFamily: DISPLAY, fontSize: 96, lineHeight: 1.02, whiteSpace: 'pre', color: H.cream, textShadow: '0 4px 0 rgba(40,5,8,0.7)'}}>{thumb.title}</div>
      </div>
      <Img src={staticFile(MANACOST.logo)} style={{position: 'absolute', left: 56, bottom: 40, height: 130}} />
    </AbsoluteFill>
  );
};

// Регистрация ролика по шаблону (в src/studios/manacost-youtube/Root.tsx): композиция <id> (16:9) и обложка <id>-thumb
export const YtCompositions: React.FC<{config: YtConfig}> = ({config}) => (
  <>
    <Composition
      id={config.id}
      component={YtVideo}
      defaultProps={{config} as YtProps}
      calculateMetadata={calcYt}
      durationInFrames={300}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Still id={`${config.id}-thumb`} component={YtThumb} defaultProps={{config}} width={1280} height={720} />
  </>
);
