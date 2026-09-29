// Витрина библиотеки ассетов public/lib (композиции Library-Showcase и Library-Showcase-16x9):
// живые фоны → локации → герои → предметы → эффекты, у каждого подпись с именем для кода.
import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {
  C,
  clamp,
  Embers,
  INTER,
  Kicker,
  LIB_CHARS,
  LIB_FX,
  LIB_LOOPS,
  LIB_PROPS,
  LIB_SCENES,
  LibBackdrop,
  libChar,
  LibFx,
  libLoop,
  libProp,
  LoopVideo,
  Title,
  useEnter,
  useFrameSize,
} from '../../brand';

const Label: React.FC<{text: string; y?: number}> = ({text, y}) => {
  const {height} = useFrameSize();
  return (
    <div
      style={{
        position: 'absolute',
        top: y ?? height - 220,
        width: '100%',
        textAlign: 'center',
        fontFamily: INTER,
        fontWeight: 800,
        fontSize: 40,
        color: C.cream,
        textShadow: '0 2px 12px rgba(0,0,0,0.9)',
      }}
    >
      {text}
    </div>
  );
};

const Section: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
  <AbsoluteFill>
    {children}
    <Kicker text="Библиотека HearthPulse" y={120} />
    <Title text={title} y={170} size={90} />
  </AbsoluteFill>
);

const GridCell: React.FC<{id: string; src: string; i: number; left: number; top: number; cw: number; ch: number}> = ({id, src, i, left, top, cw, ch}) => {
  const p = useEnter(i * 3, 18);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: cw,
        height: ch,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px)`,
      }}
    >
      <Img src={staticFile(src)} style={{maxWidth: cw * 0.9, maxHeight: ch * 0.78, objectFit: 'contain', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))'}} />
      <div style={{fontFamily: INTER, fontWeight: 700, fontSize: 22, color: C.goldBright, marginTop: 6}}>{id}</div>
    </div>
  );
};

const Grid = <T extends string,>({items, src, cols: colsV, colsH}: {items: readonly T[]; src: (id: T) => string; cols: number; colsH: number}) => {
  const {width, height, wide} = useFrameSize();
  const cols = wide ? colsH : colsV;
  const top = 360;
  const rows = Math.ceil(items.length / cols);
  const cw = (width - 80) / cols;
  const ch = (height - top - 80) / rows;
  return (
    <>
      {items.map((id, i) => (
        <GridCell key={id} id={id} src={src(id)} i={i} left={40 + (i % cols) * cw} top={top + Math.floor(i / cols) * ch} cw={cw} ch={ch} />
      ))}
    </>
  );
};

const Dark: React.FC = () => <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, ${C.bordo} 0%, ${C.bordoDeep} 50%, ${C.night} 100%)`}} />;

const FxCell: React.FC<{id: (typeof LIB_FX)[number]}> = ({id}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Dark />
      <LibFx id={id} at={2} len={40} opacity={Math.min(1, interpolate(f, [0, 4], [0, 1], clamp))} />
      <Label text={`fx: ${id}`} />
    </AbsoluteFill>
  );
};

// Циклы сняты только в 9:16 — в горизонтали показываем их карточкой поверх размытой локации
const LoopShow: React.FC<{id: (typeof LIB_LOOPS)[number]}> = ({id}) => {
  const {wide, height} = useFrameSize();
  const p = useEnter(4, 20);
  if (!wide) return <LibBackdrop id={id} dur={LOOP_LEN} dim={0.25} />;
  const h = height - 420;
  return (
    <AbsoluteFill>
      <LibBackdrop id={id} dur={LOOP_LEN} dim={0.55} blur={14} live={false} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 330,
          width: (h * 9) / 16,
          height: h,
          marginLeft: (-h * 9) / 32,
          borderRadius: 18,
          overflow: 'hidden',
          border: `3px solid ${C.gold}`,
          boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 40px ${C.goldBright}33`,
          opacity: p,
          transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})`,
        }}
      >
        <LoopVideo src={libLoop(id).v} />
      </div>
    </AbsoluteFill>
  );
};

const LOOP_LEN = 75;
const BG_LEN = 36;
const GRID_LEN = 150;
const FX_LEN = 45;

export const SHOWCASE_DURATION = LIB_LOOPS.length * LOOP_LEN + LIB_SCENES.length * BG_LEN + GRID_LEN * 2 + LIB_FX.length * FX_LEN;

export const LibraryShowcase: React.FC = () => {
  const {wide, height} = useFrameSize();
  let t = 0;
  const at = (len: number) => {
    const from = t;
    t += len;
    return {from, durationInFrames: len};
  };
  return (
    <AbsoluteFill style={{background: C.night}}>
      {LIB_LOOPS.map((id) => (
        <Sequence key={`loop-${id}`} {...at(LOOP_LEN)}>
          <Section title="Живые фоны">
            <LoopShow id={id} />
            <Embers count={20} seed={id} />
            <Label text={`libLoop('${id}')`} y={wide ? height - 80 : undefined} />
          </Section>
        </Sequence>
      ))}
      {LIB_SCENES.map((id) => (
        <Sequence key={`bg-${id}`} {...at(BG_LEN)}>
          <Section title="Локации">
            <LibBackdrop id={id} dur={BG_LEN} dim={0.2} live={false} />
            <Label text={`libArt('${id}')`} />
          </Section>
        </Sequence>
      ))}
      <Sequence {...at(GRID_LEN)}>
        <Section title="Герои">
          <Dark />
          <Grid items={LIB_CHARS} src={libChar} cols={4} colsH={7} />
        </Section>
      </Sequence>
      <Sequence {...at(GRID_LEN)}>
        <Section title="Предметы и иконки">
          <Dark />
          <Grid items={LIB_PROPS} src={libProp} cols={4} colsH={6} />
        </Section>
      </Sequence>
      {LIB_FX.map((id) => (
        <Sequence key={`fx-${id}`} {...at(FX_LEN)}>
          <FxCell id={id} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
