// Витрина анимаций HearthPulse (композиции Motion-Showcase и Motion-Showcase-16x9): каждый приём движения
// из src/hearthpulse отдельно, с подписью — имя для кода, длительность, кривая. Шапка и подпись неподвижны,
// чтобы двигалось только то, что показываем. Принципы движения бренда — video/BRAND.md.
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {
  Bg,
  BrandBug,
  C,
  Char,
  clamp,
  DISPLAY,
  Embers,
  exitProgress,
  Highlight,
  HoverLayer,
  INTER,
  Kicker,
  LibFx,
  LibProp,
  Panel,
  PulseCut,
  PulseLine,
  smooth,
  Title,
  useEnter,
  useFrameSize,
  Wordmark,
} from '../../../hearthpulse';

const MATCHUPS: [number, number] = [2238, 1328];
const META: [number, number] = [1120, 460];
const HOVER: [number, number] = [1040, 736];
const TABLE: [number, number] = [2238, 4800];

const Dark: React.FC = () => <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, ${C.bordo} 0%, ${C.bordoDeep} 55%, ${C.night} 100%)`}} />;

// Неподвижные шапка и подпись: название приёма и его «паспорт»
const Caption: React.FC<{n: number; of: number; name: string; spec: string}> = ({n, of, name, spec}) => {
  const {height, wide} = useFrameSize();
  return (
    <>
      <div style={{position: 'absolute', top: wide ? 36 : 70, width: '100%', textAlign: 'center', fontFamily: INTER, fontWeight: 800, fontSize: wide ? 24 : 30, letterSpacing: 6, color: C.gold}}>
        АНИМАЦИИ HEARTHPULSE · {n}/{of}
      </div>
      <div
        style={{
          position: 'absolute',
          top: height - (wide ? 150 : 250),
          left: 60,
          right: 60,
          textAlign: 'center',
          textShadow: '0 2px 14px rgba(0,0,0,0.95)',
        }}
      >
        <div style={{fontFamily: DISPLAY, fontSize: wide ? 56 : 64, color: C.goldBright}}>{name}</div>
        <div style={{fontFamily: INTER, fontWeight: 700, fontSize: wide ? 26 : 32, color: C.cream, marginTop: 8, lineHeight: 1.3}}>{spec}</div>
      </div>
    </>
  );
};

// Кривые бренда: три шарика проходят один путь — пружина входа, плавная кривая, ускорение ухода
const Curves: React.FC = () => {
  const f = useCurrentFrame();
  const {width, height, wide} = useFrameSize();
  const spring = useEnter(10);
  const rows: [string, number][] = [
    ['useEnter — пружина входа (d20 s90)', spring],
    ['smooth — bezier(.45,0,.55,1)', interpolate(f, [10, 40], [0, 1], {...clamp, easing: smooth})],
    ['exitProgress — уход, cubic-in 12 к.', exitProgress(f, 10, 12)],
  ];
  const x0 = wide ? 360 : 110;
  const x1 = width - x0;
  const top = height * (wide ? 0.3 : 0.36);
  const gap = wide ? 150 : 190;
  return (
    <>
      <Dark />
      {rows.map(([label, p], i) => (
        <React.Fragment key={label}>
          <div style={{position: 'absolute', left: x0, top: top + i * gap - 56, fontFamily: INTER, fontWeight: 700, fontSize: wide ? 26 : 30, color: C.cream}}>{label}</div>
          <div style={{position: 'absolute', left: x0, width: x1 - x0, top: top + i * gap, height: 3, background: `${C.gold}55`}} />
          <div
            style={{
              position: 'absolute',
              left: x0 + (x1 - x0) * p - 22,
              top: top + i * gap - 21,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: C.goldBright,
              boxShadow: `0 0 24px ${C.goldBright}`,
            }}
          />
        </React.Fragment>
      ))}
    </>
  );
};

// Смена кадра через PulseCut: 16 кадров с центром на стыке
const CutDemo: React.FC = () => (
  <>
    <Sequence durationInFrames={30}>
      <Bg src="art/naxx.jpg" dur={30} dim={0.55} />
    </Sequence>
    <Sequence from={30}>
      <Bg src="art/badlands.jpg" dur={40} dim={0.55} />
    </Sequence>
    <Sequence from={22} durationInFrames={16}>
      <PulseCut />
    </Sequence>
  </>
);

const WordmarkDemo: React.FC = () => {
  const p = useEnter(8);
  const {height} = useFrameSize();
  return (
    <>
      <Dark />
      <AbsoluteFill style={{alignItems: 'center', top: height * 0.4}}>
        <Wordmark size={150} gleamFrom={20} blur={(1 - p) * 10} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`}} />
      </AbsoluteFill>
    </>
  );
};

// Панель со снимком сайта: вход, парение, уход
const PanelDemo: React.FC<{from: 'bottom' | 'left' | 'right' | 'zoom' | 'scroll'; dur: number}> = ({from, dur}) => {
  const {wide} = useFrameSize();
  return (
    <>
      <Dark />
      <Panel src="ui/matchups.png" size={MATCHUPS} w={wide ? 1000 : 960} y={wide ? 250 : 640} from={from} delay={6} exitAt={dur - 20} />
    </>
  );
};

const ScrollDemo: React.FC = () => {
  const {wide} = useFrameSize();
  return (
    <>
      <Dark />
      <Panel src="ui/archetypes-table.png" size={TABLE} w={wide ? 900 : 960} y={wide ? 170 : 420} viewH={wide ? 660 : 1000} delay={4} scroll={[20, 100, 0, wide ? -1050 : -1200]} />
    </>
  );
};

const HighlightDemo: React.FC = () => {
  const {wide} = useFrameSize();
  return (
    <>
      <Dark />
      <Panel src="ui/matchups.png" size={MATCHUPS} w={wide ? 1000 : 960} y={wide ? 250 : 640} delay={0}>
        <Highlight rect={[80, 530, 650, 84]} size={MATCHUPS} delay={14} />
        <Highlight rect={[1550, 530, 660, 84]} size={MATCHUPS} delay={34} />
      </Panel>
    </>
  );
};

const HoverDemo: React.FC = () => {
  const {wide} = useFrameSize();
  return (
    <>
      <Dark />
      <Panel src="ui/cards-nohover.png" size={HOVER} w={wide ? 960 : 1000} y={wide ? 200 : 560} delay={0}>
        <HoverLayer
          size={HOVER}
          hover={{
            at: 40,
            cursor: [190, 300],
            layers: [
              {src: 'ui/cards-hover-card.png', rect: [0, 0, 370, 736]},
              {src: 'ui/cards-hover-popup.png', rect: [370, 104, 640, 624], pop: true},
            ],
          }}
        />
      </Panel>
    </>
  );
};

const CharDemo: React.FC = () => (
  <>
    <Bg src="art/badlands.jpg" dur={100} dim={0.75} />
    <Char src="chars/rogue.png" h={900} side="left" offset={-40} from="bottom" delay={6} />
    <Char src="chars/mage.png" h={900} side="right" offset={-40} from="side" delay={16} flip />
  </>
);

const PropDemo: React.FC = () => {
  const {width, height} = useFrameSize();
  return (
    <>
      <Dark />
      <LibProp id="chest-open" x={width * 0.3} y={height * 0.45} size={320} delay={4} />
      <LibProp id="mana-gem" x={width * 0.5} y={height * 0.4} size={220} delay={12} spin={6} />
      <LibProp id="trophy" x={width * 0.7} y={height * 0.45} size={300} delay={20} />
    </>
  );
};

const BugDemo: React.FC = () => (
  <>
    <Bg src="art/naxx.jpg" dur={70} dim={0.5} />
    <BrandBug />
  </>
);

type Item = {name: string; spec: string; len: number; render: (len: number) => React.ReactNode};

const pulseY = (h: number, wide: boolean) => (wide ? h * 0.45 : h * 0.47);

const ITEMS: Item[] = [
  {
    name: 'Кривые бренда',
    spec: 'вход — пружина, на экране — smooth, уход — ускорение',
    len: 70,
    render: () => <Curves />,
  },
  {
    name: 'Kicker',
    spec: 'надзаголовок: ромбы, разрядка сходится, линии растут · ~22 к. · уход 12 к.',
    len: 70,
    render: (len) => (
      <>
        <Dark />
        <HeightCenter render={(y) => <Kicker text="Мета снова изменилась" y={y} delay={6} exitAt={len - 18} />} />
      </>
    ),
  },
  {
    name: 'Title',
    spec: 'слова из размытия, шаг 4 к. · ~25 к. + 4 на слово · блик каждые 80 к. · уход 12 к.',
    len: 100,
    render: (len) => (
      <>
        <Dark />
        <HeightCenter dy={-80} render={(y) => <Title text={'Чем играть\nпосле патча?'} y={y} size={120} delay={6} exitAt={len - 18} />} />
      </>
    ),
  },
  {
    name: 'Wordmark / GoldText',
    spec: 'золотой текст: проявление из размытия (useEnter) + бегущий блик 70 к.',
    len: 80,
    render: () => <WordmarkDemo />,
  },
  {
    name: 'PulseLine',
    spec: 'кардиограмма рисуется слева направо · 18–20 к. · Easing.out(quad)',
    len: 50,
    render: () => (
      <>
        <Dark />
        <PulseY render={(y) => <PulseLine y={y} beats={[400]} amp={150} dur={18} delay={6} />} />
      </>
    ),
  },
  {
    name: 'PulseLine loop',
    spec: 'бегущий отрезок пульса, период dur · фон для финала',
    len: 90,
    render: () => (
      <>
        <Dark />
        <PulseY render={(y) => <PulseLine y={y} beats={[160, 700]} amp={70} dur={40} loop stroke={5} />} />
      </>
    ),
  },
  {
    name: 'PulseCut',
    spec: 'стык сцен: пульс на весь кадр + золотая вспышка · 16 к. с центром на стыке',
    len: 70,
    render: () => <CutDemo />,
  },
  {
    name: 'Bg',
    spec: 'медленный наезд Ken Burns 1.06→1.18 на всю сцену + бордовая тонировка',
    len: 90,
    render: (len) => <Bg src="art/naxx.jpg" dur={len} from={1.05} to={1.3} focus="52% 40%" dim={0.5} />,
  },
  {
    name: 'Embers',
    spec: 'фоновые искры: всплывают, покачиваются, мерцают · постоянно',
    len: 90,
    render: () => (
      <>
        <Dark />
        <Embers count={90} seed="showcase" />
      </>
    ),
  },
  {
    name: 'Char',
    spec: 'персонаж выезжает снизу или сбоку (пружина ~25 к.), потом «дышит» ±1,2%',
    len: 100,
    render: () => <CharDemo />,
  },
  {
    name: 'Panel from="bottom"',
    spec: 'снимок сайта поднимается с наклоном 12° · ~25 к. · парит ±5 px · уход вверх 16 к.',
    len: 90,
    render: (len) => <PanelDemo from="bottom" dur={len} />,
  },
  {
    name: 'Panel from="left"',
    spec: 'въезд сбоку на 700 px · пружина ~25 к.',
    len: 80,
    render: (len) => <PanelDemo from="left" dur={len} />,
  },
  {
    name: 'Panel from="zoom"',
    spec: 'проявление с увеличением 0.8→1',
    len: 80,
    render: (len) => <PanelDemo from="zoom" dur={len} />,
  },
  {
    name: 'Panel from="scroll"',
    spec: 'въезд прокруткой из-за края кадра · 47 к. (один такт) · размытие по скорости',
    len: 90,
    render: (len) => <PanelDemo from="scroll" dur={len} />,
  },
  {
    name: 'Panel scroll',
    spec: 'прокрутка длинной страницы внутри рамки · путь — не больше экрана за такт',
    len: 110,
    render: () => <ScrollDemo />,
  },
  {
    name: 'Highlight',
    spec: 'золотая рамка на цифре: 1.15→1 за ~20 к., потом пульс свечения',
    len: 90,
    render: () => <HighlightDemo />,
  },
  {
    name: 'HoverLayer',
    spec: 'курсор подъезжает (21 к.), нажатие, кольцо, проявляется состояние hover',
    len: 100,
    render: () => <HoverDemo />,
  },
  {
    name: 'LibProp',
    spec: 'предмет выпрыгивает 0.7→1 и поднимается (~20 к.), покачивается ±8 px',
    len: 90,
    render: () => <PropDemo />,
  },
  {
    name: 'LibFx',
    spec: 'вспышка-эффект поверх кадра (screen): рост 6 к., затухание len',
    len: 50,
    render: () => (
      <>
        <Dark />
        <LibFx id="sparkle-burst" at={6} len={36} />
      </>
    ),
  },
  {
    name: 'BrandBug',
    spec: 'логотип в углу: пружина на входе, пульс свечения, уход за 10 к. до конца',
    len: 70,
    render: () => <BugDemo />,
  },
];

const HeightCenter: React.FC<{render: (y: number) => React.ReactNode; dy?: number}> = ({render, dy = 0}) => {
  const {height} = useFrameSize();
  return <>{render(height * 0.42 + dy)}</>;
};

const PulseY: React.FC<{render: (y: number) => React.ReactNode}> = ({render}) => {
  const {height, wide} = useFrameSize();
  return <>{render(pulseY(height, wide))}</>;
};

export const MOTION_SHOWCASE_DURATION = ITEMS.reduce((s, it) => s + it.len, 0);

export const MotionShowcase: React.FC = () => {
  let t = 0;
  return (
    <AbsoluteFill style={{background: C.night}}>
      {ITEMS.map((it, i) => {
        const from = t;
        t += it.len;
        return (
          <Sequence key={it.name} from={from} durationInFrames={it.len}>
            {it.render(it.len)}
            <Caption n={i + 1} of={ITEMS.length} name={it.name} spec={it.spec} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
