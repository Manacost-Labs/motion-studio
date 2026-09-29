// Колода — «Компендиум»: шапка из сукна (герб, класс · режим, название, место в топе), слева раздел «Главное»
// и под ним «Матч-апы», справа постер колоды из api.blizzcore.ru с камерой, которая наезжает на карты под голос.
// Карта, которую назвали, но которой нет в колоде, показывается карточкой слева. Топ-3 открывается заставкой места.
// Без постера — список
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {
  crestFor,
  DeckFooter,
  DeckList,
  DeckPoster,
  HeaderBand,
  MainPoints,
  Mural,
  OffDeckCard,
  offDeckDim,
  Page,
  planCamera,
  RankReveal,
  Sfx,
  VersusBlock,
} from '../parts';
import {TOP_REVEAL, timeAt} from '../timing';
import {DeckSeg, SegTiming} from '../types';

// Зона постера справа. Без субтитров в кадре колоде отдана и нижняя полоса; левая колонка всегда одной ширины
const BOX_SUBS = {right: 1856, top: 172, w: 963, h: 748};
const BOX = {right: 1856, top: 176, w: 963, h: 862};
const COL = {x: 64, w: BOX.right - BOX.w - 64 - 44};
const POINT_GAP = 90; // тезисы загораются не чаще, чем раз в 3 с

export const DeckScene: React.FC<{seg: DeckSeg; t: SegTiming; rankOf?: number; subs?: boolean}> = ({seg, t, rankOf, subs = false}) => {
  const at = timeAt(t, seg.vo, 30);
  const cards = (seg.cards ?? []).map((c, i, all) => ({id: c.id, at: at(c.at, i, all.length)}));
  const points = (seg.points ?? []).map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  for (let i = 1; i < points.length; i++) points[i].at = Math.max(points[i].at, points[i - 1].at + POINT_GAP);
  const vs = (seg.vs ?? []).map((v, i, all) => ({...v, t: at(v.at, i, all.length)}));
  const p = seg.poster;
  const box = subs ? BOX_SUBS : BOX;
  const k = p ? Math.min(box.w / p.w, box.h / p.h) : 1;
  const pw = p ? Math.round(p.w * k) : 520;
  const ph = p ? Math.round(p.h * k) : box.h;
  const plan = useMemo(() => (p ? planCamera(p, cards, t.dur, {w: pw, h: ph}) : null), [p, JSON.stringify(cards), t.dur, pw, ph]);
  const px = box.right - pw;
  const py = box.top + Math.round((box.h - ph) / 2);
  const lit: Record<string, number[]> = {};
  for (const c of cards) (lit[c.id] ??= []).push(c.at);
  // названные карты, которых нет на постере — карточкой в нижнем левом углу
  const offDeck = p ? cards.filter((c) => !p.order.includes(c.id)) : [];
  const low = subs ? {y: 700, h: 190} : {y: 712, h: 300};
  const reveal = seg.rank !== undefined && seg.rank <= TOP_REVEAL;
  return (
    <AbsoluteFill>
      <Page />
      {seg.mural && <Mural src={seg.mural} x={-80} y={420} h={760} opacity={0.18} />}
      {p && plan ? (
        <DeckPoster p={p} plan={plan} x={px} y={py} w={pw} h={ph} dur={t.dur} />
      ) : (
        <DeckList list={seg.list} x={px} y={box.top} w={pw} h={ph} at={14} lit={lit} />
      )}
      <MainPoints items={points} x={COL.x} y={176} w={COL.w} footer={<DeckFooter dust={p?.dust} />} />
      <VersusBlock items={vs} x={COL.x} y={low.y + 20} w={COL.w} dim={offDeck.length ? offDeckDim(offDeck.map((c) => c.at)) : undefined} />
      {offDeck.map((c, i) => (
        <OffDeckCard key={i} id={c.id} at={c.at} x={COL.x} y={low.y} h={low.h} />
      ))}
      <HeaderBand kicker={`${seg.cls} · ${seg.mode}`} title={seg.name} crest={crestFor(seg.cls)} rank={seg.rank} rankOf={rankOf} />
      <Sfx file="lib/sfx/page-turn.wav" at={2} volume={0.22} />
      {plan?.lifts.map((l, i) => (
        <Sfx key={i} file="lib/sfx/card-draw.wav" at={l.a + 4} volume={0.2} />
      ))}
      {reveal && (
        <>
          <RankReveal rank={seg.rank!} of={rankOf} />
          <Sfx file="lib/sfx/drum-hit.wav" at={1} volume={0.42} />
        </>
      )}
    </AbsoluteFill>
  );
};
