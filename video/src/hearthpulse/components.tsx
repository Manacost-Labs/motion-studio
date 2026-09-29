import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Loop,
  OffthreadVideo,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {C, DISPLAY, INTER} from './theme';

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const smooth = Easing.bezier(0.45, 0, 0.55, 1);

// Размер кадра и ориентация: вертикаль 1080×1920 или горизонталь 1920×1080
export const useFrameSize = () => {
  const {width, height} = useVideoConfig();
  return {width, height, wide: width > height};
};

// Мягкое появление без пружинистого подскока
export const useEnter = (delay = 0, damping = 20) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, stiffness: 90, mass: 1}});
};

// Плавный уход перед сменой сцены: 0 → 1 за len кадров, начиная с at
export const exitProgress = (frame: number, at: number | undefined, len = 12) =>
  at === undefined ? 0 : interpolate(frame - at, [0, len], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});

// Бегущий блик для текста с background-clip: позиция полосы света, повторяется каждые period кадров
const gleamPos = (frame: number, start: number, period = 80) => {
  if (frame < start) return 110;
  const t = ((frame - start) % period) / period;
  return interpolate(t, [0, 0.4], [110, -10], clamp);
};
const GLEAM_BAND = 'linear-gradient(100deg, transparent 38%, rgba(255,248,225,0.95) 50%, transparent 62%)';

// Плавное появление и исчезновение сцены. Первая сцена начинается без затемнения, последняя не уходит в чёрное
export const SceneFade: React.FC<{dur: number; fadeIn?: boolean; fadeOut?: boolean; children: React.ReactNode}> = ({
  dur,
  fadeIn = true,
  fadeOut = true,
  children,
}) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn ? interpolate(f, [0, 5], [0, 1], clamp) : 1, fadeOut ? interpolate(f, [dur - 5, dur], [1, 0], clamp) : 1);
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

// Длительность «прокрутки страницы» между блоками сайта — один такт музыки (4 доли по ~11,8 кадра)
export const SCROLL_FRAMES = 47;

// Тонировка в бордо и виньетка поверх арта или живого видео
export const Grade: React.FC<{dim: number; tint?: string}> = ({dim, tint = C.bordoDeep}) => (
  <>
    <AbsoluteFill
      style={{
        opacity: dim,
        background: `linear-gradient(180deg, ${tint} 0%, ${tint}99 30%, ${tint}88 60%, ${C.night} 100%)`,
      }}
    />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.75) 100%)'}} />
  </>
);

// Арт на фоне: медленный наезд, тонировка в бордо, виньетка (raw — без тонировки, для стартовых кадров)
export const Bg: React.FC<{
  src: string;
  dur: number;
  from?: number;
  to?: number;
  focus?: string;
  blur?: number;
  dim?: number;
  tint?: string;
  raw?: boolean;
}> = ({src, dur, from = 1.06, to = 1.18, focus = '50% 50%', blur = 0, dim = 0.6, tint = C.bordoDeep, raw = false}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [from, to], clamp);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: C.night}}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: focus,
          transform: `scale(${s})`,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
      {!raw && <Grade dim={dim} tint={tint} />}
    </AbsoluteFill>
  );
};

// Живой фон из Higgsfield, сверху лёгкий наезд.
// shift опускает клип вниз (сверху проступает то, что лежит под ним), fadeTop — мягкий верхний край в %
export const LiveBg: React.FC<{
  src: string;
  dur: number;
  zoom?: number;
  blur?: number;
  grade?: number;
  tint?: string;
  shift?: number;
  fadeTop?: number;
  // Длина клипа в кадрах (30 fps). Если сцена длиннее, клип чуть замедляется, а не обрывается
  clipFrames?: number;
  // Зацикленный клип (первый кадр = последний): повторяется, а не замедляется
  loop?: boolean;
}> = ({src, dur, zoom = 1.06, blur = 0, grade, tint, shift = 0, fadeTop = 0, clipFrames, loop}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], [1, zoom], clamp);
  const mask = fadeTop ? `linear-gradient(to bottom, transparent 0%, #000 ${fadeTop}%)` : undefined;
  const rate = !loop && clipFrames && dur > clipFrames - 3 ? (clipFrames - 3) / dur : 1;
  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      muted
      playbackRate={rate}
      style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, filter: blur ? `blur(${blur}px)` : undefined}}
    />
  );
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: shift ? undefined : C.night}}>
      <AbsoluteFill style={{transform: `translateY(${shift}px)`, WebkitMaskImage: mask, maskImage: mask}}>
        {loop ? <Loop durationInFrames={clipFrames ?? 150}>{video}</Loop> : video}
      </AbsoluteFill>
      {grade !== undefined && <Grade dim={grade} tint={tint} />}
    </AbsoluteFill>
  );
};

// Персонаж-вырезка: выход сбоку и лёгкое «дыхание»
export const Char: React.FC<{
  src: string;
  h: number;
  side: 'left' | 'right';
  offset: number;
  bottom?: number;
  delay?: number;
  from?: 'side' | 'bottom';
  glow?: string;
  flip?: boolean;
  z?: number;
  // Растушёвка краёв в % — прячет прямые срезы у обрезанных PNG
  feather?: {top?: number; left?: number; right?: number};
}> = ({src, h, side, offset, bottom = 0, delay = 0, from = 'side', glow = C.goldBright, flip = false, z = 0, feather}) => {
  const f = useCurrentFrame();
  const p = useEnter(delay, 22);
  const dir = side === 'left' ? -1 : 1;
  const tx = from === 'side' ? (1 - p) * 420 * dir : 0;
  const ty = from === 'bottom' ? (1 - p) * 420 : 0;
  const breathe = 1 + 0.012 * Math.sin((f - delay) / 16);
  const masks = [
    feather?.top && `linear-gradient(to bottom, transparent 0%, #000 ${feather.top}%)`,
    feather?.left && `linear-gradient(to right, transparent 0%, #000 ${feather.left}%)`,
    feather?.right && `linear-gradient(to left, transparent 0%, #000 ${feather.right}%)`,
  ].filter(Boolean) as string[];
  const mask = masks.length ? masks.join(', ') : undefined;
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        [side]: offset,
        bottom,
        height: h,
        zIndex: z,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskComposite: mask ? 'source-in' : undefined,
        maskComposite: mask ? 'intersect' : undefined,
        opacity: Math.min(1, p * 1.4),
        transformOrigin: '50% 100%',
        transform: `translate(${tx}px, ${ty}px) scale(${breathe}) ${flip ? 'scaleX(-1)' : ''}`,
        filter: `drop-shadow(0 0 30px ${glow}55) drop-shadow(0 30px 40px rgba(0,0,0,0.6))`,
      }}
    />
  );
};

// Кадр интерфейса HearthPulse в золотой рамке.
// from: как появляется; 'scroll' — въезжает снизу как при прокрутке страницы.
// exitMode: 'fade' — уплывает вверх и гаснет; 'scroll' — уезжает вверх целиком, как при прокрутке.
// scroll: [начало, конец, от px, до px] — прокрутка содержимого внутри рамки
export const Panel: React.FC<{
  src: string;
  size: [number, number];
  w: number;
  y: number;
  x?: number;
  delay?: number;
  from?: 'bottom' | 'left' | 'right' | 'zoom' | 'scroll';
  exitAt?: number;
  exitMode?: 'fade' | 'scroll';
  viewH?: number;
  scroll?: [number, number, number, number];
  zoom?: [number, number, number, number, string];
  reveal?: boolean;
  children?: React.ReactNode;
}> = ({src, size, w, y, x: xProp, delay = 0, from = 'bottom', exitAt, exitMode = 'fade', viewH, scroll, zoom, reveal, children}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const x = xProp ?? width / 2;
  const p = useEnter(delay, 22);
  const imgH = (w * size[1]) / size[0];
  const boxH = viewH ?? imgH;
  // Путь «прокрутки» — ровно столько, чтобы панель ушла за край кадра (а не на весь экран)
  const travel = Math.max(height - y, y + boxH) + 20;

  let tx = 0;
  let ty = 0;
  let sc = 0.94 + 0.06 * p;
  let rx = 0;
  let opacity = Math.min(1, p * 1.25);
  if (from === 'bottom') {
    ty = (1 - p) * 220;
    rx = (1 - p) * 12;
  } else if (from === 'left') tx = (1 - p) * -700;
  else if (from === 'right') tx = (1 - p) * 700;
  else if (from === 'zoom') sc = 0.8 + 0.2 * p;
  else {
    const s = interpolate(f - delay, [0, SCROLL_FRAMES], [1, 0], {...clamp, easing: smooth});
    ty = s * travel;
    sc = 1;
    opacity = f < delay ? 0 : 1;
  }

  // Скорость «прокрутки» — для лёгкого размытия в движении, чтобы быстрый сдвиг не выглядел рывком
  const scrollSpeed = (t: number) =>
    Math.abs(
      interpolate(t + 1, [0, SCROLL_FRAMES], [0, 1], {...clamp, easing: smooth}) - interpolate(t, [0, SCROLL_FRAMES], [0, 1], {...clamp, easing: smooth}),
    ) * travel;
  let motionBlur = from === 'scroll' ? scrollSpeed(f - delay) : 0;

  if (exitAt !== undefined) {
    if (exitMode === 'scroll') {
      const e = interpolate(f - exitAt, [0, SCROLL_FRAMES], [0, 1], {...clamp, easing: smooth});
      ty -= e * travel;
      motionBlur = Math.max(motionBlur, scrollSpeed(f - exitAt));
    } else {
      const e = interpolate(f - exitAt, [0, 16], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
      ty -= e * 160;
      opacity *= 1 - e;
    }
  }
  ty += Math.sin((f - delay) / 26) * 5;
  const ry = Math.sin((f - delay) / 40) * 1.2;

  const scrollY = scroll ? interpolate(f, [scroll[0], scroll[1]], [scroll[2], scroll[3]], {...clamp, easing: smooth}) : 0;
  const zs = zoom ? interpolate(f, [zoom[0], zoom[1]], [1, zoom[2]], {...clamp, easing: smooth}) : 1;
  const clip = reveal ? interpolate(p, [0, 1], [100, 0], clamp) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y,
        width: w,
        height: boxH,
        opacity,
        transform: `perspective(1800px) translate(${tx}px, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})`,
        filter: motionBlur > 8 ? `blur(${Math.min(3, (motionBlur - 8) * 0.06)}px)` : undefined,
        transformOrigin: '50% 0%',
        borderRadius: 14,
        border: `4px solid ${C.gold}`,
        boxShadow: `0 0 0 3px #2a1206, 0 40px 90px rgba(0,0,0,0.7), 0 0 50px ${C.goldBright}33`,
        overflow: 'hidden',
        clipPath: reveal ? `inset(0 0 ${clip}% 0)` : undefined,
        background: C.parchment,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: scrollY,
          width: w,
          height: imgH,
          transform: `scale(${zs})`,
          transformOrigin: zoom ? zoom[4] : '50% 50%',
        }}
      >
        <Img src={staticFile(src)} style={{width: w, height: imgH, display: 'block'}} />
        {children}
      </div>
    </div>
  );
};

// Подсветка важной цифры внутри панели (координаты в пикселях исходного скриншота)
export const Highlight: React.FC<{rect: [number, number, number, number]; size: [number, number]; delay: number}> = ({
  rect,
  size,
  delay,
}) => {
  const f = useCurrentFrame();
  const p = useEnter(delay, 18);
  const pulse = 0.5 + 0.5 * Math.sin((f - delay) / 7);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${(rect[0] / size[0]) * 100}%`,
        top: `${(rect[1] / size[1]) * 100}%`,
        width: `${(rect[2] / size[0]) * 100}%`,
        height: `${(rect[3] / size[1]) * 100}%`,
        border: `5px solid ${C.goldBright}`,
        borderRadius: 12,
        opacity: p,
        transform: `scale(${1.15 - 0.15 * p})`,
        boxShadow: `0 0 ${18 + pulse * 22}px ${C.goldBright}, inset 0 0 ${10 + pulse * 12}px ${C.goldBright}88`,
      }}
    />
  );
};

// «Наведение» на элемент страницы: курсор подъезжает к цели, после клика-наведения проявляются слои
// из снимка страницы в состоянии hover (подсказка, подсветка карты). Координаты — в пикселях исходного скриншота.
export type HoverSpec = {
  at: number; // кадр, когда курсор «наводится»
  cursor: [number, number]; // куда подъезжает курсор
  from?: [number, number]; // откуда выезжает (по умолчанию из правого нижнего угла)
  layers: {src: string; rect: [number, number, number, number]; pop?: boolean}[];
};
const CURSOR_PATH = 'M2 2 L2 30 L10 22.5 L15.5 34 L21 31.5 L15.8 20.5 L26 20.5 Z';

export const HoverLayer: React.FC<{hover: HoverSpec; size: [number, number]}> = ({hover, size}) => {
  const f = useCurrentFrame();
  const pct = (v: number, i: 0 | 1) => `${(v / size[i]) * 100}%`;
  const start = hover.from ?? [size[0] * 0.95, size[1] * 1.05];
  const move = interpolate(f, [hover.at - 24, hover.at - 3], [0, 1], {...clamp, easing: smooth});
  const cx = start[0] + (hover.cursor[0] - start[0]) * move;
  const cy = start[1] + (hover.cursor[1] - start[1]) * move;
  const cursorIn = interpolate(f, [hover.at - 26, hover.at - 18], [0, 1], clamp);
  const press = 1 - 0.14 * Math.sin(Math.PI * interpolate(f, [hover.at - 2, hover.at + 6], [0, 1], clamp));
  const ring = interpolate(f, [hover.at, hover.at + 14], [0, 1], clamp);
  const show = interpolate(f, [hover.at, hover.at + 10], [0, 1], {...clamp, easing: smooth});
  return (
    <>
      {hover.layers.map((l, i) => (
        <Img
          key={i}
          src={staticFile(l.src)}
          style={{
            position: 'absolute',
            left: pct(l.rect[0], 0),
            top: pct(l.rect[1], 1),
            width: pct(l.rect[2], 0),
            height: pct(l.rect[3], 1),
            opacity: show,
            transformOrigin: '0% 30%',
            transform: l.pop ? `translateY(${(1 - show) * 14}px) scale(${0.95 + 0.05 * show})` : undefined,
            filter: l.pop ? `drop-shadow(0 ${20 * show}px ${30 * show}px rgba(0,0,0,0.35))` : undefined,
          }}
        />
      ))}
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: pct(hover.cursor[0], 0),
            top: pct(hover.cursor[1], 1),
            width: 90,
            height: 90,
            marginLeft: -45,
            marginTop: -45,
            borderRadius: '50%',
            border: `4px solid ${C.goldBright}`,
            opacity: 1 - ring,
            transform: `scale(${0.3 + ring})`,
          }}
        />
      )}
      <svg
        viewBox="0 0 32 38"
        width={52}
        height={62}
        style={{
          position: 'absolute',
          left: pct(cx, 0),
          top: pct(cy, 1),
          marginLeft: -4,
          marginTop: -4,
          opacity: cursorIn,
          transform: `scale(${press})`,
          transformOrigin: '4px 4px',
          filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.5))',
        }}
      >
        <path d={CURSOR_PATH} fill="#fff" stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
    </>
  );
};

// Заголовок шрифтом сайта. Слова мягко проявляются из размытия, текст слегка покачивается,
// по нему периодически пробегает золотой блик, перед exitAt слова уходят вверх. x задан — выравнивание влево
export const Title: React.FC<{text: string; y: number; size?: number; delay?: number; width?: number; x?: number; exitAt?: number}> = ({
  text,
  y,
  size = 110,
  delay = 0,
  width = 1000,
  x,
  exitAt,
}) => {
  const f = useCurrentFrame();
  const {fps, width: frameW} = useVideoConfig();
  let i = 0;
  const float = Math.sin((f - delay) / 30) * 4;
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x ?? (frameW - width) / 2,
        width,
        textAlign: x === undefined ? 'center' : 'left',
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 1.02,
        transform: `translateY(${float}px)`,
      }}
    >
      {text.split('\n').map((line, li) => (
        <div key={li}>
          {line.split(' ').map((word, wi) => {
            const idx = i++;
            const d = delay + idx * 4;
            const p = spring({frame: f - d, fps, config: {damping: 20, stiffness: 80, mass: 1}});
            const e = exitProgress(f, exitAt === undefined ? undefined : exitAt + idx * 2, 12);
            const blur = (1 - p) * 12 + e * 10;
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  position: 'relative',
                  margin: x === undefined ? `0 ${size * 0.12}px` : `0 ${size * 0.24}px 0 0`,
                  opacity: Math.min(1, p * 1.5) * (1 - e),
                  transform: `translateY(${(1 - p) * 46 - e * 40}px) scale(${0.94 + 0.06 * p})`,
                  filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                }}
              >
                <span
                  style={{
                    color: C.cream,
                    WebkitTextStroke: `${Math.round(size * 0.07)}px ${C.ink}`,
                    paintOrder: 'stroke fill',
                    textShadow: `0 ${size * 0.06}px 0 ${C.ink}, 0 12px 40px rgba(0,0,0,0.7)`,
                  }}
                >
                  {word}
                </span>
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    color: 'transparent',
                    backgroundImage: GLEAM_BAND,
                    backgroundSize: '300% 100%',
                    backgroundPosition: `${gleamPos(f, delay + 24 + idx * 3)}% 0`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Надзаголовок: золотые капсы с ромбами. Буквы «сходятся» при появлении, ромбы мерцают. x задан — влево от x
export const Kicker: React.FC<{text: string; y: number; delay?: number; x?: number; exitAt?: number}> = ({text, y, delay = 0, x, exitAt}) => {
  const f = useCurrentFrame();
  const p = useEnter(delay, 22);
  const e = exitProgress(f, exitAt, 12);
  const {width} = useVideoConfig();
  const left = x !== undefined;
  const twinkle = 0.75 + 0.25 * Math.sin((f - delay) / 8);
  // Длинный текст (3 пункта) — мельче и с короткими линиями, чтобы всегда оставаться в одну строку
  const long = !left && text.length > 22;
  const line = (long ? 36 : 70) * p;
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x ?? 0,
        width: left ? width - x : width,
        display: 'flex',
        justifyContent: left ? 'flex-start' : 'center',
        alignItems: 'center',
        gap: long ? 16 : 22,
        whiteSpace: 'nowrap',
        opacity: p * (1 - e),
        transform: `translateY(${(1 - p) * -16 - e * 20}px)`,
        filter: e > 0.02 ? `blur(${e * 6}px)` : undefined,
        fontFamily: INTER,
        fontWeight: 800,
        fontSize: long ? 27 : 30,
        letterSpacing: (long ? 4 : 6) + (1 - p) * 4,
        textTransform: 'uppercase',
        color: C.goldBright,
        textShadow: '0 2px 10px rgba(0,0,0,0.8)',
      }}
    >
      {!left && <span style={{width: line, height: 3, background: C.gold}} />}
      <span style={{opacity: twinkle, transform: `scale(${0.9 + 0.2 * twinkle})`}}>◆</span>
      <span>{text}</span>
      <span style={{opacity: twinkle, transform: `scale(${0.9 + 0.2 * twinkle})`}}>◆</span>
      <span style={{width: line, height: 3, background: C.gold}} />
    </div>
  );
};

// Кардиограмма — фирменный приём HearthPulse
const beat = (x: number, m: number, a: number) =>
  `L${x},${m} L${x + 18},${m - a * 0.12} L${x + 36},${m} L${x + 60},${m} L${x + 80},${m - a} L${x + 104},${m + a * 0.55} ` +
  `L${x + 122},${m - a * 0.18} L${x + 136},${m} L${x + 172},${m} L${x + 198},${m - a * 0.22} L${x + 226},${m}`;
export const ecg = (w: number, m: number, a: number, beats: number[]) =>
  `M0,${m} ${beats.map((b) => beat(b, m, a)).join(' ')} L${w},${m}`;

export const PulseLine: React.FC<{
  y: number;
  beats?: number[];
  amp?: number;
  delay?: number;
  dur?: number;
  loop?: boolean;
  color?: string;
  stroke?: number;
}> = ({y, beats = [420], amp = 150, delay = 0, dur = 20, loop = false, color = C.goldBright, stroke = 7}) => {
  const f = useCurrentFrame();
  const {width: W} = useVideoConfig();
  const m = amp + 20;
  const d = ecg(W, m, amp, beats);
  const len = getLength(d);
  const raw = (f - delay) / dur;
  const t = loop ? ((raw % 1) + 1) % 1 : Math.min(1, Math.max(0, raw));
  const eased = loop ? t : Easing.out(Easing.quad)(t);
  const head = getPointAtLength(d, len * eased);
  const evo = evolvePath(eased, d);
  const seg = 520;
  // В цикле линия гаснет у краёв круга, чтобы перескок в начало не был виден
  const loopFade = loop ? interpolate(t, [0, 0.12, 0.88, 1], [0, 1, 1, 0], clamp) : 1;
  return (
    <svg
      width={W}
      height={m * 2}
      style={{position: 'absolute', left: 0, top: y - m, overflow: 'visible', opacity: raw < 0 ? 0 : loopFade}}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 22px ${color})`}}
        {...(loop
          ? {strokeDasharray: `${seg} ${len}`, strokeDashoffset: seg - len * eased}
          : {strokeDasharray: evo.strokeDasharray, strokeDashoffset: evo.strokeDashoffset})}
      />
      {head && <circle cx={head.x} cy={head.y} r={stroke * 1.6} fill="#fff" style={{filter: `drop-shadow(0 0 14px ${color})`}} />}
    </svg>
  );
};

// Золотые искры, поднимающиеся вверх
export const Embers: React.FC<{count?: number; seed?: string; color?: string}> = ({count = 36, seed = 'e', color = C.goldBright}) => {
  const f = useCurrentFrame();
  const {width: W, height: H} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {new Array(count).fill(0).map((_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const size = 3 + r('s') * 7;
        const speed = 2 + r('v') * 5;
        const x = r('x') * W + Math.sin((f + r('p') * 100) / 18) * 20;
        const y = H + 60 - ((f * speed + r('y') * H * 1.4) % (H + 160));
        const flicker = 0.4 + 0.6 * Math.abs(Math.sin((f + r('f') * 50) / 6));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity: flicker * 0.8,
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Маленький логотип сверху во время сцен о продукте, логотип мягко светится
// Ставится один раз на весь отрезок ролика (см. Spot, параметр bug), чтобы не мигать на стыках сцен
export const BrandBug: React.FC = () => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const p = useEnter(0, 24) * interpolate(f, [durationInFrames - 10, durationInFrames], [1, 0], clamp);
  const {width, wide} = useFrameSize();
  const glow = 10 + 8 * (0.5 + 0.5 * Math.sin(f / 12));
  return (
    <div
      style={{
        position: 'absolute',
        top: wide ? 60 : 140,
        left: wide ? 100 : 0,
        width: wide ? undefined : width,
        display: 'flex',
        justifyContent: wide ? 'flex-start' : 'center',
        alignItems: 'center',
        gap: 14,
        opacity: 0.95 * p,
      }}
    >
      <Img src={staticFile('brand/hearthpulse-logo-hd.png')} style={{height: 58, filter: `drop-shadow(0 0 ${glow}px ${C.goldBright}88)`}} />
      <span
        style={{
          fontFamily: DISPLAY,
          fontSize: 44,
          color: C.cream,
          WebkitTextStroke: `3px ${C.ink}`,
          paintOrder: 'stroke fill',
        }}
      >
        HearthPulse
      </span>
    </div>
  );
};

// Золотой градиентный текст (название, цена) с бегущим бликом
export const GoldText: React.FC<{children: React.ReactNode; size: number; gleamFrom?: number; blur?: number; style?: React.CSSProperties}> = ({
  children,
  size,
  gleamFrom = 20,
  blur = 0,
  style,
}) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontSize: size,
        lineHeight: 1.05,
        backgroundImage: `${GLEAM_BAND}, linear-gradient(180deg, ${C.cream} 0%, ${C.goldBright} 55%, #B8822F 100%)`,
        backgroundSize: '300% 100%, 100% 100%',
        backgroundPosition: `${gleamPos(f, gleamFrom, 70)}% 0, 0 0`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        ...style,
        filter: `${blur > 0.3 ? `blur(${blur}px) ` : ''}drop-shadow(0 ${size * 0.05}px 0 ${C.ink}) drop-shadow(0 0 30px rgba(0,0,0,0.6))`,
      }}
    >
      {children}
    </div>
  );
};

export const Wordmark: React.FC<{size: number; gleamFrom?: number; blur?: number; style?: React.CSSProperties}> = ({size, gleamFrom, blur, style}) => (
  <GoldText size={size} gleamFrom={gleamFrom} blur={blur} style={{lineHeight: 1, ...style}}>
    HearthPulse
  </GoldText>
);
