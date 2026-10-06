// Стиль-кадр B «Газета»: патч-ноут как полоса ежедневной газеты — шапка-логотип, линейки, колонки, крупный заголовок
// с засечками, сплэш как фотография номера с подписью, штамп «ослаблен/усилен» красной краской, цифры — таблицей.
// Две краски: чёрная и красная, бумага — светлая газетная. Данные — ./data.ts
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadPTSerif} from '@remotion/google-fonts/PTSerif';
import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';
import {abilityOf, ALSO, HERO, HERO_RANKS, iconOf, nameOf, SOURCE, SOURCE_LINE, SPLASH, splashOf, VERDICT_RU, type Entry, type Verdict} from './data';

const {fontFamily: HEAD} = loadPlayfair('normal', {weights: ['700', '800', '900'], subsets: ['cyrillic', 'latin']});
const {fontFamily: TEXT} = loadPTSerif('normal', {weights: ['400', '700'], subsets: ['cyrillic', 'latin']});
loadPTSerif('italic', {weights: ['400'], subsets: ['cyrillic', 'latin']});
const {fontFamily: LABEL} = loadOswald('normal', {weights: ['500', '600', '700'], subsets: ['cyrillic', 'latin']});

// Краски; контраст к бумаге: INK 15,9:1, GREY 7,6:1, RED 5,8:1
const PAPER = '#F2EFE7';
const INK = '#151515';
const GREY = '#4D4B47';
const RED = '#B3222A';
const STAMP: Record<Verdict, string> = {buff: INK, nerf: RED, adjust: GREY};

// Штамп: двойная рамка, прописные, лёгкий поворот — оттиск краской, без «потёртостей» и шума
const Stamp: React.FC<{v: Verdict; size: number; rotate: number}> = ({v, size, rotate}) => (
  <div
    style={{
      display: 'inline-block',
      transform: `rotate(${rotate}deg)`,
      border: `${Math.round(size / 9)}px double ${STAMP[v]}`,
      padding: `${size * 0.08}px ${size * 0.35}px ${size * 0.04}px`,
      fontFamily: LABEL,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: size * 0.08,
      color: STAMP[v],
      textTransform: 'uppercase',
      lineHeight: 1.1,
    }}
  >
    {VERDICT_RU[v]}
  </div>
);

const Rule: React.FC<{w?: number; style?: React.CSSProperties}> = ({w = 1, style}) => <div style={{borderTop: `${w}px solid ${INK}`, ...style}} />;

// Заметка правой колонки: иконка, имя, штамп, текст изменений одной фразой
const Brief: React.FC<{e: Entry}> = ({e}) => (
  <div>
    <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
      <Img src={iconOf(e.id)} style={{width: 80, height: 80, display: 'block', border: `1px solid ${INK}`}} />
      <div style={{fontFamily: HEAD, fontWeight: 800, fontSize: 58, color: INK, lineHeight: 1}}>{nameOf(e.id)}</div>
      <div style={{marginLeft: 'auto'}}>
        <Stamp v={e.verdict} size={30} rotate={-5} />
      </div>
    </div>
    {e.lines.map((l) => (
      <div key={l.what} style={{fontFamily: TEXT, fontSize: 29, lineHeight: 1.36, color: INK, marginTop: 14}}>
        <b>{l.key ? `${l.key} «${l.spell}»` : l.what}</b>
        {l.key ? `, ${l.what.toLowerCase()}` : ''}:
        <div style={{display: 'grid', gridTemplateColumns: '96px auto', columnGap: 12, marginTop: 4, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: LABEL, fontSize: 24, color: GREY, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center'}}>было</span>
          <span style={{color: GREY}}>{l.before}</span>
          <span style={{fontFamily: LABEL, fontSize: 24, color: GREY, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'center'}}>стало</span>
          <span>
            <b>{l.after}</b>
            {l.unit ? ` ${l.unit}` : ''}
          </span>
        </div>
      </div>
    ))}
  </div>
);

const PW = 800; // фото номера: 800 / 1215 → 1,32× в 4K
const PH = Math.round((PW * SPLASH.h) / SPLASH.w);

export const StyleB: React.FC = () => {
  const line = HERO.lines[0];
  return (
    <AbsoluteFill style={{background: PAPER, color: INK}}>
      {/* Шапка */}
      <div style={{position: 'absolute', left: 60, right: 60, top: 36}}>
        <Rule w={2} />
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 6px'}}>
          <div style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, letterSpacing: 2, color: GREY, width: 380, textTransform: 'uppercase'}}>Выпуск {SOURCE.patch}</div>
          <div style={{fontFamily: HEAD, fontWeight: 900, fontSize: 104, lineHeight: 1, letterSpacing: 1}}>Патч {SOURCE.patch}</div>
          <div style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, letterSpacing: 2, color: GREY, width: 380, textAlign: 'right', textTransform: 'uppercase'}}>Изменения чемпионов</div>
        </div>
        <Rule w={5} />
        <Rule w={1} style={{marginTop: 4}} />
      </div>

      {/* Главная заметка */}
      <div style={{position: 'absolute', left: 60, top: 222, width: 1190}}>
        <div style={{fontFamily: HEAD, fontWeight: 800, fontSize: 74, lineHeight: 1.08}}>
          «{line.spell}» {nameOf(HERO.id)}а перезаряжается дольше
        </div>
        <div style={{display: 'flex', gap: 34, marginTop: 26}}>
          <div>
            <Img src={splashOf(HERO.id)} style={{width: PW, height: PH, display: 'block'}} />
            <div style={{fontFamily: TEXT, fontStyle: 'italic', fontSize: 24, color: GREY, marginTop: 10}}>
              {nameOf(HERO.id)}, «{HERO.title}». Базовый образ, арт — Riot Games
            </div>
          </div>
          <div style={{flex: 1, borderLeft: `1px solid ${INK}`, paddingLeft: 30}}>
            <Stamp v={HERO.verdict} size={54} rotate={-6} />
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 34}}>
              <Img src={abilityOf(HERO.id, line.key!)} style={{width: 64, height: 64, display: 'block'}} />
              <div>
                <div style={{fontFamily: LABEL, fontWeight: 600, fontSize: 34, lineHeight: 1.1, whiteSpace: 'nowrap'}}>
                  {line.key} «{line.spell}»
                </div>
                <div style={{fontFamily: LABEL, fontWeight: 500, fontSize: 26, color: GREY, textTransform: 'uppercase', letterSpacing: 1}}>{line.what}, с</div>
              </div>
            </div>
            <table style={{borderCollapse: 'collapse', marginTop: 20, width: '100%', fontFamily: LABEL}}>
              <thead>
                <tr style={{fontSize: 24, color: GREY, textTransform: 'uppercase', letterSpacing: 1}}>
                  <td style={{paddingBottom: 6}}>ранг</td>
                  <td style={{paddingBottom: 6, textAlign: 'right'}}>было</td>
                  <td style={{paddingBottom: 6, textAlign: 'right'}}>стало</td>
                </tr>
              </thead>
              <tbody>
                {HERO_RANKS.map((r) => (
                  <tr key={r.rank} style={{borderTop: `1px solid ${INK}`}}>
                    <td style={{fontSize: 40, fontWeight: 500, padding: '8px 0'}}>{r.rank}</td>
                    <td style={{fontSize: 40, fontWeight: 500, textAlign: 'right', color: GREY}}>{r.before}</td>
                    <td style={{fontSize: 48, fontWeight: 700, textAlign: 'right', color: RED}}>{r.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Колонка «Также в выпуске» */}
      <div style={{position: 'absolute', left: 1282, top: 222, bottom: 96, borderLeft: `1px solid ${INK}`}} />
      <div style={{position: 'absolute', left: 1316, right: 60, top: 222}}>
        <div style={{fontFamily: LABEL, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: RED, textTransform: 'uppercase'}}>Также в выпуске</div>
        <Rule w={2} style={{marginTop: 8, marginBottom: 26}} />
        {ALSO.map((e, i) => (
          <div key={e.id}>
            {i ? <Rule style={{margin: '30px 0'}} /> : null}
            <Brief e={e} />
          </div>
        ))}
      </div>

      {/* Подвал */}
      <div style={{position: 'absolute', left: 60, right: 60, bottom: 40}}>
        <Rule w={2} />
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: TEXT, fontSize: 24, color: GREY, marginTop: 10}}>
          <span>Источник: {SOURCE_LINE}</span>
          <span>Цифры — из данных клиента, не из патчноута</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
