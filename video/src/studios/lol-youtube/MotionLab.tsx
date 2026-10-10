// Проба движения «Газеты» (композиция lol-motion-lab, не для публикации): две полосы сцены patch-champion
// (games/lol/scenes/patchChampion.tsx) — Ноктюрн, затем Атрокс — со сменой полос кляксой (gazetteLook('ink'), looks/gazette/ink.tsx);
// на каждой полосе — одна пометка маркером под строкой умения (looks/gazette/marker.tsx). Стык собран как в движке
// (core/video/VoicedVideo.tsx): уходящая полоса живёт ещё overlap кадров под входящей. Без голоса: время фраз — по тексту
// (timeAt без записи), текст сжат под пробу. Цифры — разница Data Dragon 16.18.1 → 16.19.1 (как во фрагменте lol-patch-26-19-demo).
// Частота — как у роликов канала (Root.tsx), движение в «кадрах-30», поэтому одинаково и в черновике на 30 к/с
import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {BASE_FPS, FrameScale} from '../../core/time/fps';
import type {SegTiming} from '../../core/video/types';
import {gazetteLook} from '../../looks/gazette/look';
import {PatchChampionScene, type PatchChampionSeg} from '../../games/lol/scenes/patchChampion';

const look = gazetteLook('ink');

const SOURCE = 'Data Dragon 16.18.1 → 16.19.1 (патчи 26.18 → 26.19)';
const NOTE = 'Цифры — из данных клиента, не из патчноута';

const NOCTURNE: PatchChampionSeg = {
  id: 'nocturne',
  kind: 'patch-champion',
  patch: '26.19',
  headline: '«Паранойя» Ноктюрна перезаряжается дольше',
  headlineAt: 'Главное ослабление',
  hero: {
    id: 'Nocturne',
    title: 'Извечный кошмар',
    verdict: 'nerf',
    stampAt: 'Ноктюрн',
    ability: {key: 'R', spell: 'Паранойя', what: 'Перезарядка', unit: 'с', at: 'Перезарядка'},
    ranks: [
      {rank: 1, before: '140', after: '160', at: 'на первом ранге'},
      {rank: 2, before: '115', after: '130', at: 'на втором'},
      {rank: 3, before: '90', after: '100', at: 'на третьем'},
    ],
  },
  also: [
    {id: 'Aatrox', verdict: 'buff', at: 'Атроксу', lines: [{key: 'W', spell: 'Проклятые цепи', what: 'Перезарядка', before: '20 / 18 / 16 / 14 / 12', after: '18 / 16,5 / 15 / 13,5 / 12', unit: 'с'}]},
    {
      id: 'Ryze',
      verdict: 'adjust',
      at: 'Райзу',
      lines: [
        {what: 'Броня за уровень', before: '4,2', after: '4,7', unit: ''},
        {key: 'E', spell: 'Волшебный поток', what: 'Стоимость', before: '35 / 45 / 55 / 65 / 75', after: '40 / 50 / 60 / 70 / 80', unit: 'маны'},
      ],
    },
  ],
  source: SOURCE,
  note: NOTE,
  vo:
    'Главное ослабление — Ноктюрн. Перезарядка «Паранойи» выросла на всех трёх рангах: на первом ранге — со ста сорока до ста шестидесяти, ' +
    'на втором — до ста тридцати, на третьем — до ста. Атроксу ускорили цепи, Райзу поменяли броню и стоимость.',
};

const AATROX: PatchChampionSeg = {
  id: 'aatrox',
  kind: 'patch-champion',
  patch: '26.19',
  headline: '«Проклятые цепи» Атрокса — быстрее на ранних рангах',
  headlineAt: 'Атрокс усилен',
  hero: {
    id: 'Aatrox',
    title: 'Клинок даркинов',
    verdict: 'buff',
    stampAt: 'усилен',
    ability: {key: 'W', spell: 'Проклятые цепи', what: 'Перезарядка', unit: 'с', at: 'Перезарядка'},
    ranks: [
      {rank: 1, before: '20', after: '18', at: 'на первом ранге'},
      {rank: 2, before: '18', after: '16,5', at: 'шестнадцать'},
      {rank: 3, before: '16', after: '15', at: 'пятнадцать'},
      {rank: 4, before: '14', after: '13,5', at: 'тринадцать'},
    ], // на пятом ранге 12 с — без изменений, в таблицу не идёт
  },
  also: [
    {id: 'Nocturne', verdict: 'nerf', at: 'Ноктюрн', lines: [{key: 'R', spell: 'Паранойя', what: 'Перезарядка', before: '140 / 115 / 90', after: '160 / 130 / 100', unit: 'с'}]},
    {
      id: 'Ryze',
      verdict: 'adjust',
      at: 'Райз',
      lines: [
        {what: 'Броня за уровень', before: '4,2', after: '4,7', unit: ''},
        {key: 'E', spell: 'Волшебный поток', what: 'Стоимость', before: '35 / 45 / 55 / 65 / 75', after: '40 / 50 / 60 / 70 / 80', unit: 'маны'},
      ],
    },
  ],
  source: SOURCE,
  note: NOTE,
  vo:
    'Атрокс усилен. Перезарядка «Проклятых цепей» стала короче на четырёх рангах из пяти: на первом ранге — восемнадцать секунд вместо двадцати, ' +
    'дальше шестнадцать с половиной, пятнадцать, тринадцать с половиной, на пятом — без изменений. Ноктюрн и Райз — справа.',
};

// Полосы пробы: длина и окно «речи» (в «кадрах-30»); вторая начинается кляксой (look.overlap кадров)
const PAGES: {seg: PatchChampionSeg; dur: number; voFrom: number; voDur: number}[] = [
  {seg: NOCTURNE, dur: 180, voFrom: 6, voDur: 150},
  {seg: AATROX, dur: 180, voFrom: 24, voDur: 125},
];
const timing = (p: (typeof PAGES)[number], from: number): SegTiming => ({id: p.seg.id, from, dur: p.dur, voFrom: p.voFrom, voDur: p.voDur, voice: null, subs: []});
const FROM = PAGES.map((_, i) => PAGES.slice(0, i).reduce((s, p) => s + p.dur, 0));
export const MOTION_LAB_SEC = PAGES.reduce((s, p) => s + p.dur, 0) / BASE_FPS;

export const LolMotionLab: React.FC = () => {
  const K = useVideoConfig().fps / BASE_FPS;
  const last = PAGES.length - 1;
  return (
    <FrameScale value={K}>
      <AbsoluteFill>
        <look.Backdrop />
        {PAGES.map((p, i) => (
          <Sequence key={p.seg.id} from={Math.round(FROM[i] * K)} durationInFrames={Math.round((p.dur + (i === last ? 0 : look.overlap)) * K)} name={p.seg.id}>
            <look.Frame i={i} dur={p.dur} first={i === 0} last={i === last} ctx={{}}>
              <PatchChampionScene seg={p.seg} t={timing(p, FROM[i])} subs={false} ctx={{}} />
            </look.Frame>
          </Sequence>
        ))}
      </AbsoluteFill>
    </FrameScale>
  );
};
