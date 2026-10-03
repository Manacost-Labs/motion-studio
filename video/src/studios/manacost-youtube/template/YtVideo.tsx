// Шаблон «YouTube-ролик Манакоста» (16:9, под озвучку): подборки, гайды на колоды, обзоры.
// Ролик = конфиг (src/studios/manacost-youtube/<папка>/config.ts) — список сцен любого вида (scenes/index.tsx), у каждой текст диктора vo.
// Голос: public/vo/<config.id>/<сегмент>.mp3 (или .wav/.m4a). Есть файл — сцена длится по записи,
// субтитры в режиме auto скрываются, музыка приглушается. Нет файла — длина по тексту (CPS в timing.ts).
import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction, Composition, Html5Audio, Img, interpolate, Sequence, staticFile, Still, useVideoConfig} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {DISPLAY, FPS, MANACOST} from '../brand';
import {Grain, hsRender, OVL, Page, SceneMotion, Sfx, Subtitles, useFitSize, Vignette} from './parts';
import {chapterOf, Scene, subtitleZone} from './scenes';
import {LintProbe} from './lint';
import {H, parchmentBg, redBg, TEXT} from './theme';
import {BASE_FPS, FrameScale, useK} from './fps';
import {buildSubs, estimateVo, leadFor, minFor, stripTags, tailFor, XFADE} from './timing';
import {SegTiming, YtConfig, YtProps, YtTiming} from './types';

const MUSIC_VOL = 0.45; // музыка без голоса
const MUSIC_DUCK = 0.3; // во сколько раз тише под голосом

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
    for (const ext of s.vo.trim() ? ['mp3', 'wav', 'm4a'] : []) { // сцена без текста (разделитель) — голос не ищем
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
  // всё выше — в «кадрах-30» (fps.ts); ролик может рендериться в 60 к/с — тогда кадров вдвое больше
  // черновик (render.ps1 -Draft → REMOTION_DRAFT): 30 к/с для быстрых проб; тайминги в «кадрах-30» от этого не меняются
  const fps = process.env.REMOTION_DRAFT ? BASE_FPS : config.fps ?? FPS;
  const timing: YtTiming = {segments, music, total, base: BASE_FPS};
  return {durationInFrames: Math.round(total * (fps / BASE_FPS)), fps, props: {...props, timing}};
};

// Где диктор говорит (кадры-30 от начала ролика): по времени символов из <сцена>.json, паузы короче GAP — внутри речи.
// Без json — вся запись сцены
const GAP = 30; // пауза от 1 с — музыке можно чуть подняться
const speechOf = (segments: SegTiming[]) => {
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

// Музыка по кругу; под голосом приглушается, в паузах диктора от 1 с мягко поднимается (между сценами — до полной,
// внутри сцены — наполовину), к концу ролика уходит в тишину
const Music: React.FC<{timing: YtTiming}> = ({timing}) => {
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

// Фон-атмосфера (config.ambience): тихие бесшовные петли под всем роликом — гул зала, камин. Петли разной длины
// (22 и 17 с), поэтому вместе не повторяются в такт. Уровень — на ~25 дБ тише голоса; вступает за 2 с, к концу уходит
const AMB_VOL = 0.16;
const Ambience: React.FC<{timing: YtTiming; layers: string[]}> = ({timing, layers}) => {
  const K = useK();
  return (
    <>
      {layers.map((src) => (
        <Html5Audio
          key={src}
          src={staticFile(src)}
          loop
          volume={(real) => {
            const f = real / K;
            return AMB_VOL * interpolate(f, [0, 60], [0, 1], clamp) * interpolate(f, [timing.total - 90, timing.total], [1, 0], clamp);
          }}
        />
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
  const decks = config.segments.flatMap((s) => (s.kind === 'deck' && s.rank !== undefined ? [{rank: s.rank, name: s.name, cls: s.cls, dust: s.poster?.dust}] : []));
  // настоящая частота композиции, а не config.fps: черновик (REMOTION_DRAFT) идёт в 30 к/с при config.fps = 60
  const K = useVideoConfig().fps / BASE_FPS;
  return (
    <FrameScale value={K}>
    <AbsoluteFill>
      <Page />
      {config.segments.map((s, i) => {
        const t = timing.segments[i];
        const zone = subtitleZone(s);
        const last = i === n - 1;
        // стык — перелистывание страницы (parts/motion.tsx): уходящая сцена живёт ещё OVL кадров поверх входа следующей
        // место в шапке предыдущей сцены: следующая колода прокручивает номер с него, сцена без места — убирает его
        const prev = config.segments[i - 1];
        const prevRank = prev?.kind === 'deck' ? prev.rank : undefined;
        return (
          <Sequence key={s.id} from={Math.round(t.from * K)} durationInFrames={Math.round((t.dur + (last ? 0 : OVL)) * K)} name={s.id}>
            <SceneMotion dur={t.dur} first={i === 0} last={last} prevRank={prevRank} prevRankOf={prevRank !== undefined ? rankOf : undefined}>
              <Scene seg={s} t={t} rankOf={rankOf} subs={subsOn(t)} decks={decks} />
              {subsOn(t) && <Subtitles subs={t.subs} cx={zone.cx} bottom={26} maxW={zone.maxW} />}
            </SceneMotion>
            {t.voice && (
              <Sequence from={Math.round(t.voFrom * K)} layout="none">
                <Html5Audio src={staticFile(t.voice)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      {timing.segments.slice(1).map((t) => (
        <Sfx key={`cut-${t.id}`} file="lib/sfx/page-turn.wav" at={t.from - 2} volume={0.24} />
      ))}
      <Vignette />
      <Grain />
      <Music timing={timing} />
      {config.ambience?.length ? <Ambience timing={timing} layers={config.ambience} /> : null}
      {/* проверка раскладки (scripts/yt-lint.mjs) — только при её рендере */}
      {process.env.REMOTION_LINT ? <LintProbe /> : null}
    </AbsoluteFill>
    </FrameScale>
  );
};

// ─── Обложка 1280×720 «Компендиум»: слева красное сукно с заголовком, справа пергамент и три карты веером.
// Веер держится левее правого нижнего угла — там YouTube рисует плашку длительности. hook — сургучная печать ───
export const YtThumb: React.FC<{config: YtConfig}> = ({config}) => {
  const {thumb} = config;
  const titleSize = useFitSize(thumb.title, {width: 600, max: 96, min: 56}); // слева от веера карт
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
        <div style={{fontFamily: DISPLAY, fontSize: titleSize, lineHeight: 1.02, whiteSpace: 'pre', color: H.cream, textShadow: '0 4px 0 rgba(40,5,8,0.7)'}}>{thumb.title}</div>
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
