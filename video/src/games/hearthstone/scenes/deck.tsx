// Колода — «Компендиум»: шапка из сукна (герб, класс · режим, название, место в топе), слева раздел «Главное»
// и под ним «Матч-апы», справа постер колоды из api.blizzcore.ru с камерой, которая наезжает на карты под голос.
// Карта, которую назвали, но которой нет в колоде, показывается карточкой слева. Топ-3 открывается заставкой места.
// Без постера — список
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {HeaderBand, MainPoints, Mural, Page, RankReveal, REVEAL_HOLD, SEAL_DROP, WaxSeal} from '../../../looks/compendium/parts';
import {SceneBody} from '../../../looks/compendium/motion';
import {ramp} from '../../../looks/compendium/theme';
import type {CompendiumBrand} from '../../../looks/compendium/types';
import {ClipPanel, ComboPanel, crestFor, DeckFooter, DeckList, DeckPoster, insertVis, OffDeckCard, offDeckDim, VersusBlock} from './parts';
import {planCamera} from '../data/camera';
import {TOP_REVEAL} from '../data/ranks';
import {deckAssets, deckAudit, deckPace} from '../data/audit';
import {Sfx} from '../../../core/audio/Sfx';
import {timeAt} from '../../../core/voice/timing';
import type {SegTiming} from '../../../core/video/types';
import type {DeckSeg} from './types';
import {useFrame} from '../../../core/time/fps';
import {defineScene} from '../../../core/video/registry';
import {LEAD} from '../../../core/voice/calc';

// Зона постера справа. Без субтитров в кадре колоде отдана и нижняя полоса; левая колонка всегда одной ширины
const BOX_SUBS = {right: 1856, top: 172, w: 963, h: 748};
const BOX = {right: 1856, top: 176, w: 963, h: 862};
const COL = {x: 64, w: BOX.right - BOX.w - 64 - 44};
const POINT_GAP = 90; // тезисы загораются не чаще, чем раз в 3 с
const SEAL_AT = REVEAL_HOLD + 28; // печать — когда сукно заставки места ушло

export const DeckScene: React.FC<{seg: DeckSeg; t: SegTiming; rankOf?: number; subs?: boolean; brand?: CompendiumBrand}> = ({seg, t, rankOf, subs = false, brand}) => {
  const at = timeAt(t, seg.vo, 30);
  const cards = (seg.cards ?? []).map((c, i, all) => ({id: c.id, at: at(c.at, i, all.length), ink: c.ink}));
  const points = (seg.points ?? []).map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  for (let i = 1; i < points.length; i++) points[i].at = Math.max(points[i].at, points[i - 1].at + POINT_GAP);
  const vs = (seg.vs ?? []).map((v, i, all) => ({...v, t: at(v.at, i, all.length)}));
  const p = seg.poster;
  const box = subs ? BOX_SUBS : BOX;
  const k = p ? Math.min(box.w / p.w, box.h / p.h) : 1;
  const pw = p ? Math.round(p.w * k) : 520;
  const ph = p ? Math.round(p.h * k) : box.h;
  // врезки (комбо, геймплей) на месте постера: окно [a, b] по фразам; карты, названные внутри окна, камера не ищет
  const inserts = (seg.inserts ?? []).map((ins) => {
    const a = at(ins.at) - 8;
    const b = ins.to ? at(ins.to) : t.dur - 12;
    return {ins, a, b, cards: ins.kind === 'combo' ? ins.cards.map((c, i, all) => at(c.at, i, all.length)) : [], results: ins.kind === 'combo' ? ins.results.map((r) => at(r.at)) : []};
  });
  const inWindow = (x: number) => inserts.some((w) => x >= w.a && x <= w.b);
  const camCards = cards.filter((c) => !inWindow(c.at));
  const plan = useMemo(() => (p ? planCamera(p, camCards, t.dur, {w: pw, h: ph}) : null), [p, JSON.stringify(camCards), t.dur, pw, ph]);
  const f = useFrame();
  const posterVis = 1 - Math.max(0, ...inserts.map((w) => insertVis(f, w.a, w.b)));
  const px = box.right - pw;
  const py = box.top + Math.round((box.h - ph) / 2);
  const lit: Record<string, number[]> = {};
  for (const c of cards) (lit[c.id] ??= []).push(c.at);
  // названные карты, которых нет на постере, — карточкой в нижнем левом углу (кроме показанных во врезке)
  const offDeck = p ? camCards.filter((c) => !p.order.includes(c.id)) : [];
  // Левая колонка: сверху «Главное» — тезисы делят всю высоту до нижнего блока; внизу «Матч-апы» (видны с начала сцены
  // приглушёнными, загораются под голос) и строка «пыль · код колоды». Карточка «не в колоде» встаёт на место нижнего блока
  const bottom = subs ? 190 : 44;
  const rows = Math.ceil(vs.length / 2);
  const lowH = (vs.length ? 39 + rows * 62 + (rows - 1) * 14 + 28 : 0) + 40;
  const pointsH = 1080 - bottom - lowH - 40 - 176;
  const lowDim = offDeck.length ? offDeckDim(offDeck.map((c) => c.at)) : undefined;
  const reveal = seg.rank !== undefined && seg.rank <= TOP_REVEAL;
  return (
    <AbsoluteFill>
      <SceneBody>
        <Page />
        {seg.mural && <Mural src={seg.mural} x={-80} y={420} h={760} opacity={0.18} />}
        {p && plan ? (
          <div style={{opacity: posterVis}}>
            <DeckPoster p={p} plan={plan} x={px} y={py} w={pw} h={ph} dur={t.dur} at={-12} />
          </div>
        ) : (
          <DeckList list={seg.list} x={px} y={box.top} w={pw} h={ph} at={14} lit={lit} />
        )}
        {inserts.map(({ins, a, b, cards: ct, results}, i) => (
          <div key={i} style={{position: 'absolute', left: px, top: py, width: pw, height: ph}}>
            {ins.kind === 'combo' ? <ComboPanel ins={ins} times={{cards: ct, results}} a={a} b={b} w={pw} h={ph} /> : <ClipPanel ins={ins} a={a} b={b} w={pw} h={ph} />}
            <Sfx file="lib/sfx/scroll-unroll.wav" at={a} volume={0.18} />
          </div>
        ))}
        <MainPoints items={points} x={COL.x} y={176} w={COL.w} h={pointsH} ts={subs ? 46 : 52} ds={subs ? 29 : 31} />
        <div style={{position: 'absolute', left: COL.x, bottom, width: COL.w, opacity: lowDim ? lowDim(f) : 1}}>
          <VersusBlock items={vs} w={COL.w} pre={34} />
          <div style={{marginTop: vs.length ? 28 : 0, opacity: ramp(f, 26, 42)}}>
            <DeckFooter dust={p?.dust} />
          </div>
        </div>
        {/* топ-3: после заставки места на угол постера ложится сургучная печать с номером (у №1 — золотая) */}
        {reveal && (
          <>
            <WaxSeal rank={seg.rank!} gold={seg.rank === 1} ring={seg.rank === 1 ? brand?.leaderLabel && `${brand.leaderLabel} · ` : brand?.sealRing} at={SEAL_AT} x={px + pw - 58} y={py + ph - 58} />
            <Sfx file="lib/sfx/seal-stamp.wav" at={SEAL_AT + SEAL_DROP} volume={0.5} />
          </>
        )}
        {offDeck.map((c, i) => (
          <OffDeckCard key={i} id={c.id} at={c.at} x={COL.x} bottom={bottom} h={Math.max(lowH, 240)} />
        ))}
        {plan?.lifts.map((l, i) => (
          <Sfx key={i} file="lib/sfx/card-draw.wav" at={l.a + 4} volume={0.2} />
        ))}
        {/* росчерк пера вокруг карты с ink (InkCircle рисуется на постере с кадра l.a + 10) */}
        {plan?.lifts.map((l, i) => (l.ink ? <Sfx key={`ink-${i}`} file="lib/sfx/quill-scratch.wav" at={l.a + 10} volume={0.05} /> : null))}
        {/* шорох наезда камеры на названную карту (ход, который кончается подъёмом карты); отъезды и обход — без звука */}
        {plan?.moves
          .filter(([, b]) => plan.lifts.some((l) => l.a + 12 === b))
          .map(([a], i) => (
            <Sfx key={`sw-${i}`} file="lib/sfx/cam-swish.wav" at={a} volume={0.11} />
          ))}
      </SceneBody>
      <HeaderBand kicker={`${seg.cls} · ${seg.mode}`} title={seg.name} crest={crestFor(seg.cls)} rank={seg.rank} rankOf={rankOf} />
      {/* заставка места — поверх всего, включая шапку */}
      {reveal && (
        <>
          <RankReveal rank={seg.rank!} of={rankOf} leaderLabel={brand?.leaderLabel} />
          <Sfx file="lib/sfx/drum-hit.wav" at={1} volume={0.42} />
        </>
      )}
    </AbsoluteFill>
  );
};

// Место топ-3 открывается заставкой (RankReveal): пауза до голоса дольше, пока она идёт. Глава — «место. название».
// ctx.rankOf — «из скольких» мест подборки (games/hearthstone/data/ranks.ts → hsContext), ctx.brand — надписи печати
// и заставки №1 (бренд канала). Проверки и файлы — games/hearthstone/data/audit.ts
export const deck = defineScene<DeckSeg, {rankOf?: number; brand: CompendiumBrand}>({
  kind: 'deck',
  Component: ({seg, t, subs, ctx}) => <DeckScene seg={seg} t={t} rankOf={ctx.rankOf} subs={subs} brand={ctx.brand} />,
  lead: (s) => (s.rank !== undefined && s.rank <= TOP_REVEAL ? 26 : LEAD),
  chapter: (s) => (s.rank !== undefined ? `${s.rank}. ${s.name}` : s.name),
  audit: deckAudit, // простои камеры, надписи, тезисы, обводки, врезки (yt-qa)
  assets: deckAssets, // постер, рендеры карт, видео врезок
  pace: deckPace, // заставка топ-3 и врезки — «новинки» карты темпа
  // задуманные резкие смены кадра (yt-qa не считает их рывками): уход сукна заставки топ-3 и чужое видео во врезке
  jumps: (seg, t) => {
    const at = timeAt(t, seg.vo, 30);
    const zones: [number, number][] = [];
    if (seg.rank !== undefined && seg.rank <= TOP_REVEAL) zones.push([t.from + REVEAL_HOLD, t.from + REVEAL_HOLD + 20]);
    for (const ins of seg.inserts ?? []) if (ins.kind === 'clip') zones.push([t.from + at(ins.at) - 8, t.from + (ins.to ? at(ins.to) : t.dur)]);
    return zones;
  },
});
