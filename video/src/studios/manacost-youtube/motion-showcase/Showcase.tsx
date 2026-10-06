// Витрина анимаций Манакоста (композиция yt-motion-showcase, 16:9): каждый приём движения шаблона «Компендиум»
// отдельно, с подписью — имя для кода, длительность, кривая. Кадр приёма показан уменьшенным (0,8), под ним
// неподвижная подпись. Данные для колоды — образец статьи (games/hearthstone/fixtures, 1-е место). Не для публикации.
import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {clamp} from '../../../core/time/ease';
import {Grain} from '../../../core/fx/Grain';
import {SAMPLE_ARTICLE as article} from '../../../games/hearthstone/fixtures';
import {DISPLAY, EASE_IN, EASE_IN_OUT, EASE_OUT, H, ramp, redBg, TEXT} from '../../../looks/compendium/theme';
import {HeaderBand, MainPoints, Page, RankReveal, Words} from '../../../looks/compendium/parts';
import {CardRow, crestFor, DeckList, DeckPoster, HeroPortrait, OffDeckCard, VersusBlock} from '../../../games/hearthstone/scenes/parts';
import {planCamera} from '../../../games/hearthstone/data/camera';
import type {DeckPosterData} from '../../../games/hearthstone/data/types';
import {MANACOST} from '../../../brands/manacost/channel';

const W = 1920;
const HGT = 1080;
const SCALE = 0.8;
const deck = article.decks.find((d) => d.rank === 1)!;
const poster = deck.poster as DeckPosterData;

// Кадр приёма: полноразмерная сцена 1920×1080, уменьшенная до 0,8, в деревянной раме
const Stage: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: (W - W * SCALE) / 2,
      top: 24,
      width: W,
      height: HGT,
      transform: `scale(${SCALE})`,
      transformOrigin: '0 0',
      overflow: 'hidden',
      boxShadow: `0 0 0 10px ${H.wood}, 0 20px 50px rgba(0,0,0,0.5)`,
    }}
  >
    {children}
  </div>
);

const Caption: React.FC<{n: number; of: number; name: string; spec: string}> = ({n, of, name, spec}) => (
  <div style={{position: 'absolute', left: 0, right: 0, top: 24 + HGT * SCALE + 22, textAlign: 'center'}}>
    <div style={{fontFamily: DISPLAY, fontSize: 52, color: H.ink}}>
      {name} <span style={{fontFamily: TEXT, fontWeight: 700, fontSize: 24, color: H.inkMuted, letterSpacing: 3}}>· {n}/{of}</span>
    </div>
    <div style={{fontFamily: TEXT, fontWeight: 600, fontSize: 26, color: H.inkMuted, marginTop: 4}}>{spec}</div>
  </div>
);

// Кривые шаблона: один путь, три кривые ramp()
const Curves: React.FC = () => {
  const f = useCurrentFrame();
  const rows: [string, number][] = [
    ['EASE_OUT — вход (0.16,1,0.3,1)', ramp(f, 10, 40, EASE_OUT)],
    ['EASE_IN — уход (0.7,0,0.84,0)', ramp(f, 10, 40, EASE_IN)],
    ['EASE_IN_OUT — камера, шторки (0.65,0,0.35,1)', ramp(f, 10, 40, EASE_IN_OUT)],
  ];
  const x0 = 260;
  const x1 = W - 260;
  return (
    <Page>
      {rows.map(([label, p], i) => (
        <React.Fragment key={label}>
          <div style={{position: 'absolute', left: x0, top: 300 + i * 200 - 70, fontFamily: TEXT, fontWeight: 700, fontSize: 36, color: H.ink}}>{label}</div>
          <div style={{position: 'absolute', left: x0, width: x1 - x0, top: 300 + i * 200, height: 4, background: `${H.inkMuted}66`}} />
          <div style={{position: 'absolute', left: x0 + (x1 - x0) * p - 26, top: 300 + i * 200 - 24, width: 52, height: 52, borderRadius: 26, background: H.red}} />
        </React.Fragment>
      ))}
    </Page>
  );
};

// Копия стыка сегментов движка (VoicedVideo, переход стиля): растворение в чистый пергамент за 8 кадров
const DIP = 8;
const SegFadeDemo: React.FC = () => {
  const f = useCurrentFrame();
  const out = interpolate(f, [30 - DIP, 30], [1, 0], clamp);
  const inn = interpolate(f, [30, 30 + DIP], [0, 1], clamp);
  return (
    <Page>
      <AbsoluteFill style={{opacity: f < 30 ? out : 0}}>
        <HeaderBand kicker="Сцена 1" title="Первая сцена" at={-40} />
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: f >= 30 ? inn : 0}}>
        <HeaderBand kicker="Сцена 2" title="Следующая сцена" at={-40} />
      </AbsoluteFill>
    </Page>
  );
};

const PosterDemo: React.FC<{dur: number}> = ({dur}) => {
  const cards = [
    {id: 'CAP_107', at: 40},
    {id: 'EDR_456', at: 150},
  ];
  const k = Math.min(963 / poster.w, 862 / poster.h);
  const pw = Math.round(poster.w * k);
  const ph = Math.round(poster.h * k);
  const plan = useMemo(() => planCamera(poster, cards, dur, {w: pw, h: ph}), [dur, pw, ph]);
  return (
    <Page>
      <DeckPoster p={poster} plan={plan} x={(W - pw) / 2} y={(HGT - ph) / 2} w={pw} h={ph} dur={dur} />
    </Page>
  );
};

type Item = {name: string; spec: string; len: number; render: (len: number) => React.ReactNode};

const ITEMS: Item[] = [
  {name: 'Кривые шаблона', spec: 'ramp(f, a, b, кривая) — вместо пружин; на входе EASE_OUT, на уходе EASE_IN', len: 70, render: () => <Curves />},
  {
    name: 'Words',
    spec: 'слова выезжают из-под маски снизу · 16 к. + шаг 2–3 к. · уход вверх за 10 к.',
    len: 90,
    render: () => (
      <Page>
        <Words text="Пятнадцать колод для Легенды" at={10} stagger={3} dur={20} out={70} style={{position: 'absolute', left: 120, top: 420, fontFamily: DISPLAY, fontSize: 130, color: H.ink}} />
      </Page>
    ),
  },
  {
    name: 'HeaderBand',
    spec: 'шапка-сукно падает сверху (14 к.), герб, надзаголовок, заголовок Words, номер места · ~36 к.',
    len: 80,
    render: () => (
      <Page>
        <HeaderBand kicker={`${deck.cls} · ${deck.mode}`} title={deck.name} crest={crestFor(deck.cls)} rank={1} rankOf={15} at={6} />
      </Page>
    ),
  },
  {
    name: 'RankReveal',
    spec: 'заставка топ-3: цифра из-под маски (17 к.), пауза до 44, сукно уходит вверх за 18 к.',
    len: 80,
    render: () => (
      <Page>
        <RankReveal rank={1} of={15} leaderLabel={MANACOST.leaderLabel} />
      </Page>
    ),
  },
  {
    name: 'MainPoints',
    spec: 'тезисы проявляются с шагом 8 к.; тот, о котором говорит диктор, — ярко, прошлые — тише',
    len: 170,
    render: () => (
      <Page>
        <MainPoints
          items={[
            {title: 'Агро колода Гарроша', detail: 'дешёвые пираты и драконы', at: 20},
            {title: 'Стол держат драконы', detail: 'размен в начале игры', at: 70},
            {title: 'Сильна против контроля', at: 120},
          ]}
          x={300}
          y={200}
          w={1300}
          big
        />
      </Page>
    ),
  },
  {
    name: 'CardRow',
    spec: 'карта поднимается на 110 px (18 к., EASE_OUT) с размытием в движении · подпись +8 к.',
    len: 90,
    render: () => (
      <Page>
        <CardRow
          cards={[
            {id: 'CAP_107', at: 8, note: 'дешёвый пират'},
            {id: 'END_033', at: 18, note: 'дракон'},
            {id: 'TLC_600', at: 28, note: 'добор'},
          ]}
          x={64}
          w={1792}
          cy={540}
          h={600}
        />
      </Page>
    ),
  },
  {
    name: 'DeckPoster + planCamera',
    spec: 'камера наезжает на названную карту ×2.4 (26 к.), карта приподнимается, отъезд 30 к.; в паузах — обход',
    len: 260,
    render: (len) => <PosterDemo dur={len} />,
  },
  {
    name: 'DeckList',
    spec: 'список без постера: строки въезжают справа с шагом 1 к.; названная карта вспыхивает золотом',
    len: 120,
    render: () => (
      <Page>
        <DeckList list={deck.list} x={560} y={80} w={800} h={920} at={8} lit={{[deck.list[3].id]: [60]}} />
      </Page>
    ),
  },
  {
    name: 'VersusBlock',
    spec: 'матч-апы: строки въезжают слева на 14 px за 16 к. в момент, когда их называют',
    len: 100,
    render: () => (
      <Page>
        <VersusBlock
          items={[
            {cls: 'Маг', verdict: 'good', t: 10},
            {cls: 'Жрец', verdict: 'good', t: 30},
            {cls: 'Охотник', verdict: 'bad', label: 'тяжело', t: 50},
          ]}
          x={560}
          y={360}
          w={800}
        />
      </Page>
    ),
  },
  {
    name: 'OffDeckCard',
    spec: 'карта не из колоды: вход 14 к., держится 120 к., уход 12 к. (блок рядом приглушается)',
    len: 160,
    render: () => (
      <Page>
        <OffDeckCard id="TLC_817" at={10} x={700} y={240} h={600} />
      </Page>
    ),
  },
  {
    name: 'HeroPortrait',
    spec: 'портрет героя в деревянной раме поднимается на 50 px за 22 к.',
    len: 70,
    render: () => (
      <Page>
        <HeroPortrait hero={deck.hero} cx={960} cy={540} w={480} h={580} at={8} />
      </Page>
    ),
  },
  {name: 'Стык сегментов (SegFade)', spec: 'растворение в чистый пергамент: 8 к. на уход и 8 к. на вход', len: 70, render: () => <SegFadeDemo />},
  {
    name: 'Grain',
    spec: 'плёночное зерно поверх всего ролика, меняется каждый кадр · здесь усилено ×4',
    len: 60,
    render: () => (
      <Page>
        <Grain opacity={0.2} />
      </Page>
    ),
  },
];

export const YT_MOTION_SHOWCASE_DURATION = ITEMS.reduce((s, it) => s + it.len, 0);

export const YtMotionShowcase: React.FC = () => {
  let t = 0;
  return (
    <AbsoluteFill style={{...redBg}}>
      {ITEMS.map((it, i) => {
        const from = t;
        t += it.len;
        return (
          <Sequence key={it.name} from={from} durationInFrames={it.len}>
            <AbsoluteFill style={{background: H.parchmentLight}} />
            <Stage>{it.render(it.len)}</Stage>
            <Caption n={i + 1} of={ITEMS.length} name={it.name} spec={it.spec} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
