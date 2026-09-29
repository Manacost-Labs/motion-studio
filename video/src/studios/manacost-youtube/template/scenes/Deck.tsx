// Колода — «Компендиум»: шапка из сукна (герб, класс · режим, название, место в топе), слева раздел «Главное»,
// справа постер колоды из api.blizzcore.ru с камерой, которая наезжает на карты под голос. Без постера — список
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {crestFor, DeckFooter, DeckList, DeckPoster, HeaderBand, MainPoints, Mural, Page, planCamera, Sfx} from '../parts';
import {timeAt} from '../timing';
import {DeckSeg, SegTiming} from '../types';

// Зона постера: справа, между шапкой и полосой субтитров
const BOX = {right: 1856, top: 172, w: 963, h: 748};

export const DeckScene: React.FC<{seg: DeckSeg; t: SegTiming; rankOf?: number}> = ({seg, t, rankOf}) => {
  const at = timeAt(t, seg.vo, 30);
  const cards = (seg.cards ?? []).map((c, i, all) => ({id: c.id, at: at(c.at, i, all.length)}));
  const points = (seg.points ?? []).map((p, i, all) => ({title: p.text, detail: p.detail, at: at(p.at, i, all.length)}));
  const p = seg.poster;
  const plan = useMemo(() => (p ? planCamera(p, cards, t.dur) : null), [p, JSON.stringify(cards), t.dur]);
  const k = p ? Math.min(BOX.w / p.w, BOX.h / p.h) : 1;
  const pw = p ? Math.round(p.w * k) : 520;
  const ph = p ? Math.round(p.h * k) : BOX.h;
  const px = BOX.right - pw;
  const lit: Record<string, number[]> = {};
  for (const c of cards) (lit[c.id] ??= []).push(c.at);
  return (
    <AbsoluteFill>
      <Page />
      {seg.mural && <Mural src={seg.mural} x={-80} y={420} h={760} opacity={0.18} />}
      {p && plan ? (
        <DeckPoster p={p} plan={plan} x={px} y={BOX.top} w={pw} h={ph} dur={t.dur} />
      ) : (
        <DeckList list={seg.list} x={px} y={BOX.top} w={pw} h={ph} at={14} lit={lit} />
      )}
      <MainPoints items={points} x={64} y={176} w={px - 64 - 44} footer={<DeckFooter dust={p?.dust} />} />
      <HeaderBand kicker={`${seg.cls} · ${seg.mode}`} title={seg.name} crest={crestFor(seg.cls)} rank={seg.rank} rankOf={rankOf} />
      <Sfx file="lib/sfx/page-turn.wav" at={2} volume={0.22} />
      {plan?.lifts.map((l, i) => (
        <Sfx key={i} file="lib/sfx/card-draw.wav" at={l.a + 4} volume={0.2} />
      ))}
    </AbsoluteFill>
  );
};
