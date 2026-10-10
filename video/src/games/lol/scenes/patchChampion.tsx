// Сцена «изменения чемпиона в патче» — полоса газеты (стиль looks/gazette): шапка номера, заголовок, фото чемпиона со штампом
// вердикта, таблица «ранг — было — стало» по фразам диктора, справа — «также в выпуске». Всё появляется на фразу из vo (поля at)
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {defineScene, type SceneProps} from '../../../core/video/registry';
import type {BaseSeg} from '../../../core/video/types';
import {timeAt} from '../../../core/voice/timing';
import {Sfx} from '../../../core/audio/Sfx';
import {useFrame} from '../../../core/time/fps';
import {useFitSize} from '../../../core/layout/fit';
import {EASE_IN_OUT, ramp} from '../../../core/time/ease';
import {G, HEAD, LABEL, PAGE, TEXT} from '../../../looks/gazette/theme';
import {ChangeRow, Footer, Masthead, Photo, Rise, Rule, Stamp, Words} from '../../../looks/gazette/parts';
import {Marker} from '../../../looks/gazette/marker';
import {abilityOf, iconOf, nameOf, splashFile, splashOf, SPLASH, type PatchBrief, type PatchHero} from '../data/patch';

export type PatchChampionSeg = BaseSeg & {
  kind: 'patch-champion';
  patch: string; // публичный номер патча «26.19» (GAME.md, «Нумерация патчей»)
  headline: string; // заголовок главной заметки
  headlineAt?: string; // фраза, на которой появляется заголовок
  hero: PatchHero;
  also?: PatchBrief[]; // «также в выпуске» — до двух заметок
  source: string; // откуда цифры — в подвал полосы
  note?: string; // оговорка в подвале справа
};

const PW = 800; // фото номера: 800 / 1215 → 1,32× в 4K
const PH = Math.round((PW * SPLASH.h) / SPLASH.w);
const ABILITY_W = 1190 - PW - 34 - 30 - 80; // место под имя умения: колонка справа от фото минус отступ, иконка и зазор

// Заметка правой колонки: иконка, имя, штамп, изменения строками «было / стало»
const Brief: React.FC<{b: PatchBrief; at: number}> = ({b, at}) => (
  <Rise at={at}>
    <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
      <Img src={iconOf(b.id)} style={{width: 80, height: 80, display: 'block', border: `1px solid ${G.ink}`}} />
      <div style={{fontFamily: HEAD, fontWeight: 800, fontSize: 58, color: G.ink, lineHeight: 1}}>{nameOf(b.id)}</div>
      <div style={{marginLeft: 'auto'}}>
        <Stamp v={b.verdict} size={30} rotate={-5} at={at + 10} />
      </div>
    </div>
    {b.lines.map((l) => (
      <div key={l.what + (l.key ?? '')} style={{fontFamily: TEXT, fontSize: 29, lineHeight: 1.36, color: G.ink, marginTop: 14}}>
        <b>{l.key ? `${l.key} «${l.spell}»` : l.what}</b>
        {l.key ? `, ${l.what.toLowerCase()}` : ''}:
        <div style={{display: 'grid', gridTemplateColumns: '96px auto', columnGap: 12, marginTop: 4, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: LABEL, fontSize: 24, color: G.grey, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center'}}>было</span>
          <span style={{color: G.grey}}>{l.before}</span>
          <span style={{fontFamily: LABEL, fontSize: 24, color: G.grey, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center'}}>стало</span>
          <span>
            <b>{l.after}</b>
            {l.unit ? ` ${l.unit}` : ''}
          </span>
        </div>
      </div>
    ))}
  </Rise>
);

export const PatchChampionScene: React.FC<SceneProps<PatchChampionSeg>> = ({seg, t}) => {
  const f = useFrame();
  const at = timeAt(t, seg.vo, 10);
  const {hero} = seg;
  const head = at(seg.headlineAt, 0, 8) - 4;
  const stamp = at(hero.stampAt, 1, 8);
  const ability = at(hero.ability.at, 2, 8);
  const mark = ability + 20; // строка умения встаёт за 16 кадров (Rise) — маркер после неё
  const abilityText = `${hero.ability.key} «${hero.ability.spell}»`;
  // длинное имя умения («W «Проклятые цепи»») не раздвигает колонку за линейку: кегль подгоняется под ширину, не мельче 26
  const abilitySize = useFitSize(abilityText, {width: ABILITY_W, max: 34, min: 26, fontFamily: LABEL, fontWeight: 600});
  const ranks = hero.ranks.map((r, i) => at(r.at, 3 + i, 8));
  const also = (seg.also ?? []).map((b, i) => at(b.at, 6 + i, 8));
  return (
    <AbsoluteFill style={{color: G.ink}}>
      <Masthead title={`Патч ${seg.patch}`} left={`Выпуск ${seg.patch}`} right="Изменения чемпионов" at={2} />

      {/* Главная заметка */}
      <div style={{position: 'absolute', left: PAGE.left, top: 222, width: 1190}}>
        <Words text={seg.headline} at={head} stagger={2} style={{fontFamily: HEAD, fontWeight: 800, fontSize: 74, lineHeight: 1.08}} />
        <div style={{display: 'flex', gap: 34, marginTop: 26}}>
          <Photo src={splashOf(hero.id)} w={PW} h={PH} caption={`${nameOf(hero.id)}, «${hero.title}». Базовый образ, арт — Riot Games`} at={head + 6} dur={t.dur} />
          <div style={{flex: 1, paddingLeft: 30, position: 'relative'}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: G.ink, transform: `scaleY(${ramp(f, head + 6, head + 24, EASE_IN_OUT)})`, transformOrigin: '50% 0'}} />
            <Stamp v={hero.verdict} size={54} rotate={-6} at={stamp} />
            <Rise at={ability} style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 34}}>
              <Img src={abilityOf(hero.id, hero.ability.key)} style={{width: 64, height: 64, display: 'block'}} />
              <div>
                <div style={{fontFamily: LABEL, fontWeight: 600, fontSize: abilitySize, lineHeight: 1.1, whiteSpace: 'nowrap'}}>
                  {/* единственная пометка маркером на полосе: что изменилось — когда строка уже встала */}
                  <Marker at={mark}>{abilityText}</Marker>
                </div>
                <div style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, color: G.grey, textTransform: 'uppercase', letterSpacing: 1}}>
                  {hero.ability.what}
                  {hero.ability.unit ? `, ${hero.ability.unit}` : ''}
                </div>
              </div>
            </Rise>
            {/* раздельные рамки: у слитых (collapse) Chrome рисует линии строк, даже когда ячейки ещё прозрачны */}
            <table style={{borderCollapse: 'separate', borderSpacing: 0, marginTop: 20, width: '100%', fontFamily: LABEL}}>
              <thead>
                <tr style={{fontSize: 24, color: G.grey, textTransform: 'uppercase', letterSpacing: 1, opacity: ramp(f, ability + 6, ability + 20)}}>
                  <td style={{paddingBottom: 6}}>ранг</td>
                  <td style={{paddingBottom: 6, textAlign: 'right'}}>было</td>
                  <td style={{paddingBottom: 6, textAlign: 'right'}}>стало</td>
                </tr>
              </thead>
              <tbody>
                {hero.ranks.map((r, i) => (
                  <ChangeRow key={r.rank} rank={String(r.rank)} before={r.before} after={r.after} at={ranks[i]} color={hero.verdict === 'buff' ? G.ink : G.red} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Колонка «Также в выпуске» */}
      {seg.also?.length ? (
        <>
          <div style={{position: 'absolute', left: 1282, top: 222, bottom: 96, width: 1, background: G.ink, transform: `scaleY(${ramp(f, also[0] - 12, also[0] + 6, EASE_IN_OUT)})`, transformOrigin: '50% 0'}} />
          <div style={{position: 'absolute', left: 1316, right: PAGE.right, top: 222}}>
            <Rise at={also[0] - 10} dy={0} style={{fontFamily: LABEL, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: G.red, textTransform: 'uppercase'}}>
              Также в выпуске
            </Rise>
            <Rule at={also[0] - 8} w={2} style={{marginTop: 8, marginBottom: 26}} />
            {seg.also.map((b, i) => (
              <div key={b.id}>
                {i ? <Rule at={also[i] - 6} style={{margin: '30px 0'}} /> : null}
                <Brief b={b} at={also[i]} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      <Footer left={`Источник: ${seg.source}`} right={seg.note ?? ''} at={14} />

      {/* Звуки: оттиск штампа, маркер и перо по строкам таблицы — тише голоса */}
      <Sfx file="lib/sfx/seal-stamp.wav" at={stamp} volume={0.45} />
      <Sfx file="lib/sfx/quill-scratch.wav" at={mark} volume={0.04} />
      {ranks.map((r, i) => (
        <Sfx key={i} file="lib/sfx/quill-scratch.wav" at={r + 8} volume={0.05} />
      ))}
      {also.map((a, i) => (
        <Sfx key={`b${i}`} file="lib/sfx/seal-stamp.wav" at={a + 10} volume={0.25} />
      ))}
    </AbsoluteFill>
  );
};

export const patchChampion = defineScene<PatchChampionSeg>({
  kind: 'patch-champion',
  Component: PatchChampionScene,
  chapter: (seg) => `${nameOf(seg.hero.id)} — патч ${seg.patch}`,
  assets: (seg) => [seg.hero.id, ...(seg.also ?? []).map((b) => b.id)].map((id) => ({file: splashFile(id), what: `сплэш ${nameOf(id)}`})),
});
