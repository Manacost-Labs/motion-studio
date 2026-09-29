// Сцены бренда HearthPulse — из них собираются все ролики.
// Каждая сцена работает в обеих ориентациях: вертикаль 1080×1920 и горизонталь 1920×1080.
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C, INTER} from './theme';
import {
  Bg,
  Char,
  clamp,
  Embers,
  exitProgress,
  GoldText,
  Highlight,
  HoverLayer,
  HoverSpec,
  Kicker,
  LiveBg,
  Panel,
  PulseLine,
  Title,
  useEnter,
  useFrameSize,
  Wordmark,
} from './components';

export const smooth = Easing.bezier(0.45, 0, 0.55, 1);

// Сетка горизонтали: заголовки слева от LEFT_X, интерфейс справа с центром RIGHT_X
export const LEFT_X = 100;
export const RIGHT_X = 1330;
// За сколько кадров до конца сцены тексты начинают уходить (успевают исчезнуть до вспышки перехода)
export const EXIT_LEAD = 18;

// Значение для каждой ориентации: v — вертикаль 9:16, h — горизонталь 16:9
export type Orient<T> = {v: T; h: T};
export const useOrient = <T,>(o: Orient<T>): T => (useFrameSize().wide ? o.h : o.v);

// Живой клип из Higgsfield для каждой ориентации (пути в public/); len — длина клипа в кадрах при 30 fps;
// loop — клип зациклен (библиотечные живые фоны), повторяется на любую длину сцены
export type LiveSrc = {v?: string; h?: string; len?: number; loop?: boolean};
export type LiveOpts = {grade?: number; blur?: number; zoom?: number; shift?: number; fadeTop?: number; under?: React.ReactNode};

// Живой фон, если клип для этой ориентации есть, иначе статичная подложка (children)
export const Backdrop: React.FC<{dur: number; live?: LiveSrc; children: React.ReactNode} & LiveOpts> = ({
  dur,
  live,
  children,
  under,
  ...opts
}) => {
  const {wide} = useFrameSize();
  const src = wide ? live?.h : live?.v;
  return src ? (
    <>
      {under}
      <LiveBg src={src} dur={dur} clipFrames={live?.len} loop={live?.loop} {...opts} />
    </>
  ) : (
    <>{children}</>
  );
};

// Шапка сцены: надзаголовок + заголовок (+ подпись). В горизонтали слева, в вертикали по центру сверху
export const HeadLeft: React.FC<{dur: number; kicker: string; title: string; titleWide?: string; size?: number; sub?: string}> = ({
  dur,
  kicker,
  title,
  titleWide,
  size = 108,
  sub,
}) => {
  const f = useCurrentFrame();
  const {width, wide} = useFrameSize();
  const exitAt = dur - EXIT_LEAD;
  const lines = (wide ? titleWide ?? title : title).split('\n').length;
  const subP = useEnter(14, 22);
  const subE = exitProgress(f, exitAt, 12);
  return (
    <>
      {wide ? (
        <>
          <Kicker text={kicker} y={200} x={LEFT_X} delay={2} exitAt={exitAt} />
          <Title text={titleWide ?? title} y={250} x={LEFT_X} width={760} size={size} delay={4} exitAt={exitAt} />
        </>
      ) : (
        <>
          <Kicker text={kicker} y={250} delay={2} exitAt={exitAt} />
          <Title text={title} y={300} size={size} delay={4} exitAt={exitAt} />
        </>
      )}
      {sub && (
        <div
          style={{
            position: 'absolute',
            top: (wide ? 250 : 300) + lines * size * 1.02 + 18,
            left: wide ? LEFT_X : 0,
            width: wide ? 700 : width,
            textAlign: wide ? 'left' : 'center',
            fontFamily: INTER,
            fontWeight: 700,
            fontSize: 36,
            color: C.cream,
            opacity: 0.9 * subP * (1 - subE),
            transform: `translateY(${(1 - subP) * 14 - subE * 16}px)`,
            textShadow: '0 2px 12px rgba(0,0,0,0.9)',
          }}
        >
          {sub}
        </div>
      )}
    </>
  );
};

// ─── Хук: крупный вопрос на живом арте, карты летят в камеру ───
const FlyCard: React.FC<{src: string; delay: number; angle: number; spin: number}> = ({src, delay, angle, spin}) => {
  const f = useCurrentFrame();
  const {width, height, wide} = useFrameSize();
  const t = interpolate(f - delay, [0, 46], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  if (t <= 0 || t >= 1) return null;
  const dist = (wide ? 1400 : 1300) * t;
  const scale = (wide ? 0.12 : 0.18) + t * (wide ? 1.7 : 2.3);
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        left: width / 2 - 202 + Math.cos(angle) * dist,
        top: (wide ? height * 0.45 : 820) - 279 + Math.sin(angle) * dist * (wide ? 0.55 : 0.9),
        width: 404,
        // Появляется быстро, а к концу полёта гаснет — карта не пропадает резко на краю кадра
        opacity: Math.min(1, t * 6) * interpolate(t, [0.72, 0.97], [1, 0], clamp),
        transform: `scale(${scale}) rotate(${spin * t}deg)`,
        filter: `blur(${Math.max(0, (t - 0.55) * 14)}px) drop-shadow(0 20px 30px rgba(0,0,0,0.6))`,
      }}
    />
  );
};

const FLY_ANGLES = [-2.4, -0.55, 2.5, 0.7, -1.6, 1.75, -2.95, 0.15, -1.1];

export type HookProps = {
  dur: number;
  kicker: string;
  title: string;
  art: string;
  focus?: Orient<string>;
  live?: LiveSrc;
  // ID карт из public/cards (без .webp), летят в камеру
  cards?: string[];
};
export const HookScene: React.FC<HookProps> = ({dur, kicker, title, art, focus = {v: '52% 40%', h: '50% 45%'}, live, cards = []}) => {
  const {wide} = useFrameSize();
  const exitAt = dur - EXIT_LEAD;
  return (
    <AbsoluteFill>
      <Backdrop dur={dur} live={live} grade={0.62} zoom={1.12}>
        <Bg src={art} dur={dur} from={1.05} to={1.3} focus={wide ? focus.h : focus.v} dim={0.62} />
      </Backdrop>
      <Embers count={40} seed="hook" />
      {cards.map((c, i) => (
        <FlyCard
          key={c}
          src={`cards/${c}.webp`}
          delay={2 + i * 8}
          angle={FLY_ANGLES[i % FLY_ANGLES.length]}
          spin={(i % 2 ? 1 : -1) * (25 + i * 6)}
        />
      ))}
      <Kicker text={kicker} y={wide ? 300 : 600} delay={4} exitAt={exitAt} />
      <Title text={title} y={wide ? 360 : 670} size={132} width={wide ? 1400 : 1000} delay={10} exitAt={exitAt} />
    </AbsoluteFill>
  );
};

// ─── Логотип: пульс пробегает, появляется HearthPulse ───
export const LogoScene: React.FC<{dur: number; tagline?: string; art?: string}> = ({
  dur,
  tagline = 'Статистика и аналитика Hearthstone',
  art = 'art/naxx.jpg',
}) => {
  const f = useCurrentFrame();
  const p = useEnter(8, 18);
  const sub = useEnter(20, 22);
  const e = exitProgress(f, dur - 12, 12);
  const {width, wide} = useFrameSize();
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${C.bordo} 0%, ${C.bordoDeep} 45%, ${C.night} 100%)`}}>
      <Bg src={art} dur={dur} blur={22} dim={0.88} />
      <Embers count={30} seed="logo" />
      <PulseLine y={wide ? 700 : 1010} beats={[wide ? 820 : 400]} amp={wide ? 110 : 150} dur={18} />
      <div
        style={{
          position: 'absolute',
          top: wide ? 150 : 470,
          width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: wide ? 24 : 36,
          transform: `scale(${1 + interpolate(f, [0, dur], [0, 0.04])})`,
        }}
      >
        <Img
          src={staticFile('brand/hearthpulse-logo-hd.png')}
          style={{
            height: wide ? 220 : 250,
            opacity: p,
            transform: `scale(${0.5 + 0.5 * p})`,
            filter: `drop-shadow(0 0 ${40 * p}px ${C.goldBright}aa)`,
          }}
        />
        <Wordmark size={150} gleamFrom={16} blur={(1 - p) * 10} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`}} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: wide ? 800 : 1110,
          width,
          textAlign: 'center',
          fontFamily: INTER,
          fontWeight: 700,
          fontSize: 46,
          color: C.cream,
          letterSpacing: 1 + (1 - sub) * 10,
          opacity: sub * (1 - e),
          transform: `translateY(${(1 - sub) * 16 - e * 16}px)`,
          textShadow: '0 2px 12px rgba(0,0,0,0.8)',
        }}
      >
        {tagline}
      </div>
    </AbsoluteFill>
  );
};

// ─── Сцена функции: шапка + подложка (арт/персонаж или живой клип) + панели сайта ───
export type CharSpec = React.ComponentProps<typeof Char>;
export type PanelSpec = {
  src: string;
  size: [number, number];
  layout: Orient<{w: number; x?: number; y: number; viewH?: number}>;
  delay?: number;
  from?: 'bottom' | 'left' | 'right' | 'zoom' | 'scroll';
  exitAt?: number;
  exitMode?: 'fade' | 'scroll';
  reveal?: boolean;
  // Прокрутка страницы внутри рамки: с кадра start до end (по умолчанию — за концом сцены, без остановки)
  scroll?: {start: number; end?: number; dist: Orient<number>};
  zoom?: [number, number, number, number, string];
  highlights?: {rect: [number, number, number, number]; delay: number}[];
  // Курсор наводится на элемент страницы, проявляется снимок hover-состояния (см. HoverLayer)
  hover?: HoverSpec;
};
export type BackdropSpec = {
  // Один арт на обе ориентации или пара {v, h} (например, libArt('tavern') из библиотеки)
  art: string | Orient<string>;
  blur?: number;
  dim?: number;
  focus?: string;
  char?: Orient<CharSpec | undefined>;
};
export type FeatureProps = {
  dur: number;
  kicker: string;
  title: string;
  titleWide?: string;
  titleSize?: number;
  sub?: string;
  backdrop: BackdropSpec;
  live?: LiveSrc;
  liveOpts?: LiveOpts | Orient<LiveOpts>;
  panels: PanelSpec[];
};

// Статичная подложка сцены — она же стартовый кадр для оживления в Higgsfield
export const FeatureBackdrop: React.FC<{dur: number} & BackdropSpec> = ({dur, art, blur = 0, dim = 0.8, focus, char}) => {
  const {wide} = useFrameSize();
  const c = char && (wide ? char.h : char.v);
  const src = typeof art === 'string' ? art : wide ? art.h : art.v;
  return (
    <>
      <Bg src={src} dur={dur} blur={blur} dim={dim} focus={focus} />
      {c && <Char {...c} />}
    </>
  );
};

export const FeatureScene: React.FC<FeatureProps> = ({dur, kicker, title, titleWide, titleSize, sub, backdrop, live, liveOpts, panels}) => {
  const {wide} = useFrameSize();
  const opts: LiveOpts | undefined = liveOpts && 'v' in liveOpts ? (wide ? (liveOpts as Orient<LiveOpts>).h : (liveOpts as Orient<LiveOpts>).v) : (liveOpts as LiveOpts);
  return (
    <AbsoluteFill>
      <Backdrop dur={dur} live={live} zoom={1.04} {...opts}>
        <FeatureBackdrop dur={dur} {...backdrop} />
      </Backdrop>
      {panels.map((p, i) => {
        const l = wide ? p.layout.h : p.layout.v;
        return (
          <Panel
            key={i}
            src={p.src}
            size={p.size}
            w={l.w}
            x={l.x}
            y={l.y}
            viewH={l.viewH}
            delay={p.delay}
            from={p.from}
            exitAt={p.exitAt}
            exitMode={p.exitMode}
            reveal={p.reveal}
            zoom={p.zoom}
            scroll={p.scroll && [p.scroll.start, p.scroll.end ?? dur + 40, 0, wide ? p.scroll.dist.h : p.scroll.dist.v]}
          >
            {p.hover && <HoverLayer hover={p.hover} size={p.size} />}
            {p.highlights?.map((h, j) => <Highlight key={j} rect={h.rect} size={p.size} delay={h.delay} />)}
          </Panel>
        );
      })}
      {/* Шапка поверх панелей: прокручиваемая страница проходит под заголовком */}
      <HeadLeft dur={dur} kicker={kicker} title={title} titleWide={titleWide} size={titleSize} sub={sub} />
    </AbsoluteFill>
  );
};

// ─── Карусель разделов: активный в центре, внутри плавно панорамируется страница ───
export type CarouselItem = {src: string; size: [number, number]; title: string; sub: string};
// Какую часть слота раздела занимает переезд к следующему (звуки «вжух» ставятся на его начало)
export const CAROUSEL_MOVE = 0.5;

export const CarouselScene: React.FC<{dur: number; items: CarouselItem[]; kicker?: string; art?: string}> = ({
  dur,
  items,
  kicker = 'И ещё',
  art = 'art/naxx.jpg',
}) => {
  const f = useCurrentFrame();
  const {width, wide} = useFrameSize();
  const n = items.length;
  const slot = dur / n;
  // Активный раздел: держим половину слота, вторую половину мягко переезжаем к следующему
  const HOLD = 1 - CAROUSEL_MOVE;
  const ease = Easing.inOut(Easing.sin);
  const activeAt = (fr: number) => {
    const tt = fr / slot;
    const kk = Math.floor(tt);
    const ff = tt - kk;
    return Math.min(n - 1, kk + (ff < HOLD ? 0 : ease((ff - HOLD) / (1 - HOLD))));
  };
  const active = activeAt(f);
  // Скорость переезда — для лёгкого размытия в движении
  const speed = Math.abs(activeAt(f + 1) - active);

  const intro = interpolate(f, [0, 14], [0, 1], {...clamp, easing: smooth});
  const outro = exitProgress(f, dur - EXIT_LEAD, 12);
  const g = wide
    ? {cx: 1390, w: 940, viewH: 700, top: 190, spacing: 560, dotsY: 935, titleSize: 88}
    : {cx: width / 2, w: 900, viewH: 880, top: 590, spacing: 720, dotsY: 1530, titleSize: 104};
  const motionBlur = Math.min(2.5, speed * g.spacing * 0.05);

  return (
    <AbsoluteFill>
      <Bg src={art} dur={dur} blur={24} dim={0.9} />
      <Embers count={24} seed="montage" />

      {/* Панели стоят в общем 3D-пространстве: ближняя к центру оказывается сверху сама, без перескока слоёв */}
      <div style={{position: 'absolute', inset: 0, perspective: 2000}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d'}}>
        {items.map((m, i) => {
          const rel = i - active;
          const ar = Math.abs(rel);
          // В горизонтали прошедшие разделы уходят влево и гаснут, чтобы не лезть под заголовок
          const fadeOut = wide && rel < 0 ? interpolate(rel, [-0.7, 0], [0, 1], clamp) : interpolate(ar, [1.2, 1.8], [1, 0], clamp);
          if (fadeOut <= 0) return null;
          const scale = 1 - Math.min(ar, 1.5) * 0.12;
          // Страница заполняет рамку целиком; лишнее по ширине панорамируется, по высоте — прокручивается
          const kk = Math.max(g.w / m.size[0], g.viewH / m.size[1]) * 1.04;
          const imgW = m.size[0] * kk;
          const imgH = m.size[1] * kk;
          const pan = interpolate(f, [i * slot - 14, (i + 1) * slot + 14], [0, 1], {...clamp, easing: smooth});
          return (
            <div
              key={m.src}
              style={{
                position: 'absolute',
                left: g.cx - g.w / 2,
                top: g.top + (1 - intro) * 80,
                width: g.w,
                height: g.viewH,
                opacity: fadeOut * intro * (1 - outro),
                transform: `translateX(${rel * g.spacing * (wide && rel < 0 ? 0.7 : 1)}px) translateZ(${-Math.min(ar, 1.5) * 320}px) rotateY(${Math.max(-32, Math.min(32, -rel * 26))}deg) scale(${scale})`,
                filter: motionBlur > 0.3 ? `blur(${motionBlur}px)` : undefined,
                borderRadius: 14,
                border: `4px solid ${C.gold}`,
                boxShadow: `0 0 0 3px #2a1206, 0 40px 90px rgba(0,0,0,0.7), 0 0 ${ar < 0.5 ? 60 : 20}px ${C.goldBright}44`,
                overflow: 'hidden',
                background: C.parchment,
              }}
            >
              <Img
                src={staticFile(m.src)}
                style={{position: 'absolute', left: -(imgW - g.w) * pan, top: -Math.min(imgH - g.viewH, 360) * pan, width: imgW, height: imgH}}
              />
              <div style={{position: 'absolute', inset: 0, background: 'rgba(22,5,10,1)', opacity: Math.min(ar, 1) * 0.55}} />
            </div>
          );
        })}
        </div>
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: intro * (1 - outro)}}>
        <div style={{position: 'absolute', top: g.dotsY, left: g.cx - 100, width: 200, display: 'flex', justifyContent: 'center', gap: 22}}>
          {items.map((m, i) => {
            const on = interpolate(Math.abs(i - active), [0, 0.6], [1, 0], clamp);
            return (
              <span
                key={m.title}
                style={{
                  width: 16,
                  height: 16,
                  transform: `rotate(45deg) scale(${0.8 + 0.5 * on})`,
                  background: on > 0.5 ? C.goldBright : '#6b4a32',
                  boxShadow: `0 0 ${12 * on}px ${C.goldBright}`,
                }}
              />
            );
          })}
        </div>
      </div>
      {wide ? <Kicker text={kicker} y={200} x={LEFT_X} exitAt={dur - EXIT_LEAD} /> : <Kicker text={kicker} y={250} exitAt={dur - EXIT_LEAD} />}
      {items.map((m, i) => {
        const d = i - active;
        const o = interpolate(Math.abs(d), [0, 0.55], [1, 0], clamp);
        if (o <= 0) return null;
        const last = i === n - 1;
        // Заголовок раздела начинает появляться вместе с началом переезда карусели, подпись — сразу за ним
        const titleDelay = i === 0 ? 0 : i * slot - slot * CAROUSEL_MOVE;
        const subIn = interpolate(f - titleDelay - 6, [0, 10], [0, 1], {...clamp, easing: smooth});
        return (
          <div key={m.title} style={{position: 'absolute', inset: 0, opacity: o, transform: `translateY(${d * 50}px)`}}>
            {wide ? (
              <Title text={m.title} y={250} x={LEFT_X} width={780} size={g.titleSize} delay={titleDelay} exitAt={last ? dur - EXIT_LEAD : undefined} />
            ) : (
              <Title text={m.title} y={300} size={g.titleSize} delay={titleDelay} exitAt={last ? dur - EXIT_LEAD : undefined} />
            )}
            <div
              style={{
                position: 'absolute',
                top: wide ? 370 : 430,
                left: wide ? LEFT_X : 0,
                width: wide ? 700 : width,
                textAlign: wide ? 'left' : 'center',
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 36,
                color: C.cream,
                opacity: 0.88 * subIn * (1 - (last ? outro : 0)),
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              }}
            >
              {m.sub}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Финал: логотип, цена, кнопка Boosty, адрес сайта, персонажи классов ───
export type EndCardProps = {
  dur: number;
  label?: string;
  price?: string;
  url?: string;
  site?: string;
  art?: string;
  live?: LiveSrc;
  // Кадр сильной доли / финального удара музыки: на него «встаёт» цена, кнопка и адрес — следом по долям
  priceAt?: number;
  beat?: number;
};
export const EndCardScene: React.FC<EndCardProps> = ({
  dur,
  label = 'Подписка',
  price = 'от 99 ₽/мес',
  url = 'boosty.to/kolodahearthstone',
  site = 'hearthpulse.net',
  art = 'art/badlands.jpg',
  live,
  priceAt = 14,
  beat: beatLen = 12,
}) => {
  const f = useCurrentFrame();
  const {width, wide} = useFrameSize();
  const logo = useEnter(2, 18);
  const labelP = useEnter(priceAt - beatLen, 22);
  // Цена «встаёт» ровно на удар: пружине нужно ~9 кадров, поэтому она стартует заранее
  const priceP = useEnter(priceAt - 9, 16);
  const pill = useEnter(priceAt + beatLen, 16);
  const siteP = useEnter(priceAt + beatLen * 2, 22);
  const beat = 1 + 0.025 * Math.max(0, Math.sin(((f - priceAt) / beatLen) * Math.PI));
  const sheen = interpolate((((f - priceAt - beatLen * 2) % 60) + 60) % 60, [0, 30], [-60, 160], clamp);
  const y = wide
    ? {logo: 60, logoH: 140, word: 104, pulse: 400, price: 450, priceSize: 130, pill: 700, site: 810}
    : {logo: 190, logoH: 170, word: 124, pulse: 640, price: 720, priceSize: 150, pill: 985, site: 1105};
  return (
    <AbsoluteFill>
      <Backdrop dur={dur} live={live} zoom={1.08}>
        <Bg src={art} dur={dur} from={1.16} to={1.05} focus={wide ? '50% 45%' : '50% 40%'} blur={3} dim={0.72} />
      </Backdrop>
      <Embers count={50} seed="end" />
      {wide ? (
        <>
          <Char src="chars/rogue.png" h={540} side="left" offset={-160} bottom={-20} from="bottom" delay={6} />
          <Char src="chars/warlock.png" h={560} side="right" offset={-160} bottom={-20} from="bottom" delay={8} />
          <Char src="chars/dk.png" h={580} side="left" offset={30} bottom={-30} from="bottom" delay={10} z={1} />
          <Char src="chars/priest.png" h={580} side="right" offset={30} bottom={-30} from="bottom" delay={12} z={1} />
        </>
      ) : (
        <>
          <Char src="chars/rogue.png" h={560} side="left" offset={-180} bottom={-20} from="bottom" delay={6} />
          <Char src="chars/warlock.png" h={600} side="right" offset={-170} bottom={-20} from="bottom" delay={8} />
          <Char src="chars/dk.png" h={660} side="left" offset={40} bottom={-30} from="bottom" delay={10} z={1} />
          <Char src="chars/priest.png" h={660} side="right" offset={40} bottom={-30} from="bottom" delay={12} z={1} />
          <Char src="chars/mage.png" h={740} side="left" offset={width / 2 - 370} bottom={-40} from="bottom" delay={14} z={2} />
        </>
      )}
      <div style={{position: 'absolute', top: y.logo, width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 3}}>
        <Img
          src={staticFile('brand/hearthpulse-logo-hd.png')}
          style={{
            height: y.logoH,
            opacity: logo,
            transform: `scale(${0.6 + 0.4 * logo}) translateY(${Math.sin(f / 20) * 4}px)`,
            filter: `drop-shadow(0 0 ${24 + 12 * Math.sin(f / 10)}px ${C.goldBright}99)`,
          }}
        />
        <Wordmark size={y.word} gleamFrom={20} blur={(1 - logo) * 8} style={{opacity: logo}} />
      </div>
      <PulseLine y={y.pulse} beats={wide ? [300, 1400] : [160, 700]} amp={70} dur={40} loop stroke={5} />
      <div style={{position: 'absolute', top: y.price, width, textAlign: 'center', zIndex: 3}}>
        <div
          style={{
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: 8 + (1 - labelP) * 8,
            color: C.cream,
            textTransform: 'uppercase',
            opacity: labelP,
            textShadow: '0 2px 12px rgba(0,0,0,0.9)',
          }}
        >
          {label}
        </div>
        <GoldText size={y.priceSize} gleamFrom={priceAt + 8} blur={(1 - priceP) * 10} style={{opacity: priceP, transform: `scale(${(0.8 + 0.2 * priceP) * beat})`}}>
          {price}
        </GoldText>
      </div>
      <div style={{position: 'absolute', top: y.pill, width, display: 'flex', justifyContent: 'center', zIndex: 3}}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: C.boosty,
            borderRadius: 60,
            padding: '22px 46px',
            fontFamily: INTER,
            fontWeight: 800,
            fontSize: 42,
            color: '#fff',
            boxShadow: `0 0 0 4px #fff3, 0 18px 40px rgba(0,0,0,0.6), 0 0 ${30 + 14 * Math.sin(f / 9)}px ${C.boosty}99`,
            opacity: pill,
            transform: `scale(${(0.75 + 0.25 * pill) * (1 + 0.015 * Math.sin(f / 9))})`,
          }}
        >
          {url}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${sheen}%`,
              width: '30%',
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)',
              transform: 'skewX(-20deg)',
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: y.site,
          width,
          textAlign: 'center',
          zIndex: 3,
          fontFamily: INTER,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: 1 + (1 - siteP) * 12,
          color: C.cream,
          opacity: siteP * 0.9,
          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
        }}
      >
        {site}
      </div>
    </AbsoluteFill>
  );
};

// ─── Переход между сценами: вспышка и пробегающий пульс ───
export const PulseCut: React.FC = () => {
  const f = useCurrentFrame();
  const {height, wide} = useFrameSize();
  const flash = interpolate(f, [0, 8, 16], [0, 0.8, 0], {...clamp, easing: smooth});
  // Линия гаснет вместе со вспышкой, а не пропадает на последнем кадре перехода
  const lineOut = interpolate(f, [9, 16], [1, 0], clamp);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{opacity: lineOut}}>
        <PulseLine y={height / 2} beats={wide ? [300, 1200] : [150, 620]} amp={wide ? 200 : 230} dur={12} stroke={9} />
      </AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, #fff6dc 0%, ${C.goldBright} 35%, transparent 75%)`, opacity: flash}} />
    </AbsoluteFill>
  );
};
