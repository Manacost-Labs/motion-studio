// Стиль-кадр C «Чертёж»: светлый технический лист — миллиметровая сетка, рамка и штамп чертежа, сплэш как «рисунок 1»,
// выноски и размерные линии; изменение перезарядки показано шкалами по рангам (длина ∝ секундам, прирост — штриховкой).
// Хекстек здесь — только инженерная подача: без свечения, неона и тёмного HUD. Данные — ./data.ts
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {loadFont as loadPlexSans} from '@remotion/google-fonts/IBMPlexSans';
import {loadFont as loadPlexMono} from '@remotion/google-fonts/IBMPlexMono';
import {abilityOf, ALSO, HERO, HERO_RANKS, iconOf, nameOf, SOURCE, SOURCE_LINE, SPLASH, splashOf, VERDICT_RU, type Entry, type Verdict} from './data';

const {fontFamily: SANS} = loadPlexSans('normal', {weights: ['400', '500', '600', '700'], subsets: ['cyrillic', 'latin']});
const {fontFamily: MONO} = loadPlexMono('normal', {weights: ['400', '500', '600'], subsets: ['cyrillic', 'latin']});

// Лист и линии; контраст к бумаге: INK 12,7:1, MUTED 6:1, RED 5,9:1, GREEN 6,1:1, BRASS 5,3:1
const PAPER = '#F1F1EC';
const INK = '#1D2B38';
const MUTED = '#4F5D69';
const RED = '#A8322A';
const GREEN = '#2D6542';
const BRASS = '#855A14';
const VERDICT: Record<Verdict, string> = {buff: GREEN, nerf: RED, adjust: BRASS};

// Миллиметровка (фон): мелкая клетка 24 px, крупная 120 px
const Grid: React.FC = () => (
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
    <defs>
      <pattern id="c-minor" width={24} height={24} patternUnits="userSpaceOnUse">
        <path d="M24 0 L0 0 0 24" fill="none" stroke="#DEE2E0" strokeWidth={1} />
      </pattern>
      <pattern id="c-major" width={120} height={120} patternUnits="userSpaceOnUse">
        <rect width={120} height={120} fill="url(#c-minor)" />
        <path d="M120 0 L0 0 0 120" fill="none" stroke="#C9D0CF" strokeWidth={1.2} />
      </pattern>
      <pattern id="c-hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={10} stroke={RED} strokeWidth={3} />
      </pattern>
    </defs>
    <rect x={40} y={40} width={1840} height={1000} fill="url(#c-major)" />
    <rect x={28} y={28} width={1864} height={1024} fill="none" stroke={INK} strokeWidth={3} />
    <rect x={40} y={40} width={1840} height={1000} fill="none" stroke={INK} strokeWidth={1.2} />
  </svg>
);

// Метки углов вокруг рисунка — как на листе, где рисунок вклеен
const Corners: React.FC<{w: number; h: number}> = ({w, h}) => (
  <svg width={w + 40} height={h + 40} style={{position: 'absolute', left: -20, top: -20, pointerEvents: 'none'}}>
    {[
      [0, 0, 1, 1],
      [w + 40, 0, -1, 1],
      [0, h + 40, 1, -1],
      [w + 40, h + 40, -1, -1],
    ].map(([x, y, sx, sy], i) => (
      <path key={i} d={`M${x + sx * 4} ${y + sy * 28} L${x + sx * 4} ${y + sy * 4} L${x + sx * 28} ${y + sy * 4}`} fill="none" stroke={INK} strokeWidth={2} />
    ))}
  </svg>
);

// Шкалы перезарядки по рангам: было — сплошная, прирост — штриховка; ось в секундах
const SCALE = 3.6; // px на секунду: 160 с → 576 px
const Bars: React.FC = () => (
  <div>
    {HERO_RANKS.map((r) => (
      <div key={r.rank} style={{marginBottom: 12}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: 760}}>
          <span style={{fontFamily: MONO, fontSize: 26, color: MUTED}}>ранг {r.rank}</span>
          <span style={{fontFamily: MONO, fontSize: 36, fontWeight: 600, color: INK}}>
            <span style={{color: MUTED, fontWeight: 400}}>{r.before} →</span> {r.after} с <span style={{color: RED, fontSize: 30}}>+{r.after - r.before}</span>
          </span>
        </div>
        <svg width={760} height={28} style={{display: 'block', marginTop: 4}}>
          <rect x={1} y={3} width={r.before * SCALE} height={22} fill={INK} />
          <rect x={1 + r.before * SCALE} y={3} width={(r.after - r.before) * SCALE} height={22} fill="url(#c-hatch)" stroke={RED} strokeWidth={2} />
        </svg>
      </div>
    ))}
    {/* ось */}
    <svg width={760} height={46} style={{display: 'block'}}>
      <line x1={1} x2={170 * SCALE} y1={6} y2={6} stroke={INK} strokeWidth={1.5} />
      {[0, 50, 100, 150].map((s) => (
        <g key={s}>
          <line x1={1 + s * SCALE} x2={1 + s * SCALE} y1={0} y2={14} stroke={INK} strokeWidth={1.5} />
          <text x={1 + s * SCALE + (s ? 0 : 2)} y={42} fontFamily={MONO} fontSize={24} fill={MUTED} textAnchor={s ? 'middle' : 'start'}>
            {s}
          </text>
        </g>
      ))}
      <text x={170 * SCALE + 14} y={14} fontFamily={MONO} fontSize={24} fill={MUTED}>
        с
      </text>
    </svg>
  </div>
);

// Ранги в моноширинном наборе — без пробелов вокруг «/», чтобы строка помещалась целиком: 20/18/16/14/12
const tight = (s: string) => s.replace(/ \/ /g, '/');

// Смежный узел: иконка в рамке, имя, вердикт в рамке, строки «что: было → стало»
const Node: React.FC<{e: Entry}> = ({e}) => (
  <div style={{display: 'flex', gap: 20}}>
    <div style={{border: `2px solid ${INK}`, padding: 3, alignSelf: 'flex-start'}}>
      <Img src={iconOf(e.id)} style={{width: 64, height: 64, display: 'block'}} />
    </div>
    <div style={{flex: 1}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 40, color: INK, lineHeight: 1}}>{nameOf(e.id)}</span>
        <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 24, color: VERDICT[e.verdict], border: `2px solid ${VERDICT[e.verdict]}`, padding: '1px 10px', textTransform: 'uppercase', letterSpacing: 1}}>
          {VERDICT_RU[e.verdict]}
        </span>
      </div>
      {e.lines.map((l) => (
        <div key={l.what} style={{marginTop: 6}}>
          <div style={{fontFamily: SANS, fontSize: 26, color: MUTED, lineHeight: 1.2}}>{l.key ? `${l.key} «${l.spell}» · ${l.what.toLowerCase()}` : l.what}</div>
          <div style={{fontFamily: MONO, fontSize: 28, color: INK, whiteSpace: 'nowrap'}}>
            <span style={{color: MUTED}}>{tight(l.before)} →</span> <b style={{fontWeight: 600, color: VERDICT[l.verdict]}}>{tight(l.after)}</b>
            {l.unit ? ` ${l.unit}` : ''}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const SW = 880; // рисунок: 880 / 1215 → 1,45× в 4K
const SH = Math.round((SW * SPLASH.h) / SPLASH.w);

// Штамп чертежа (нижняя полоса): клетки «подпись — значение»
const Cell: React.FC<{k: string; v: string; flex?: number; color?: string}> = ({k, v, flex = 1, color = INK}) => (
  <div style={{flex, borderLeft: `1.5px solid ${INK}`, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap'}}>
    <span style={{fontFamily: MONO, fontSize: 24, color: MUTED, textTransform: 'uppercase'}}>{k}</span>
    <span style={{fontFamily: MONO, fontSize: 26, fontWeight: 600, color}}>{v}</span>
  </div>
);

export const StyleC: React.FC = () => {
  const line = HERO.lines[0];
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <Grid />

      {/* Заголовок листа */}
      <div style={{position: 'absolute', left: 80, top: 66}}>
        <div style={{fontFamily: MONO, fontSize: 26, color: MUTED, letterSpacing: 2}}>ЛИСТ 1 · ИЗМЕНЕНИЯ ЧЕМПИОНА · ПАТЧ {SOURCE.patch}</div>
        <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 112, color: INK, lineHeight: 1, marginTop: 10, letterSpacing: -1}}>{nameOf(HERO.id)}</div>
        <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 34, color: MUTED, marginTop: 8}}>{HERO.title}</div>
      </div>

      {/* Рисунок 1 — сплэш целиком, с метками углов и выноской R */}
      <div style={{position: 'absolute', left: 92, top: 318, width: SW, height: SH}}>
        <Img src={splashOf(HERO.id)} style={{width: SW, height: SH, display: 'block', outline: `1.5px solid ${INK}`}} />
        <Corners w={SW} h={SH} />
        <div style={{fontFamily: MONO, fontSize: 24, color: MUTED, marginTop: 14}}>
          Рис. 1 — {nameOf(HERO.id)}, базовый образ. Арт: Riot Games
        </div>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {/* выноска от рисунка к узлу R: кружок на рамке рисунка, ломаная к заголовку узла */}
        <polyline points={`${92 + SW},${318 + 60} 1010,${318 + 60} 1010,152 1048,152`} fill="none" stroke={INK} strokeWidth={1.5} />
        <circle cx={92 + SW} cy={318 + 60} r={6} fill={PAPER} stroke={INK} strokeWidth={2} />
      </svg>

      {/* Узел R: изменение перезарядки */}
      <div style={{position: 'absolute', left: 1060, top: 112, width: 790}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{border: `2px solid ${INK}`, padding: 3}}>
            <Img src={abilityOf(HERO.id, line.key!)} style={{width: 64, height: 64, display: 'block'}} />
          </div>
          <div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 42, color: INK, lineHeight: 1.05}}>
              Узел {line.key} · «{line.spell}»
            </div>
            <div style={{fontFamily: MONO, fontSize: 26, color: MUTED, textTransform: 'uppercase'}}>{line.what}, с</div>
          </div>
          <span style={{marginLeft: 'auto', fontFamily: MONO, fontWeight: 600, fontSize: 30, color: RED, border: `2.5px solid ${RED}`, padding: '2px 14px', textTransform: 'uppercase', letterSpacing: 1}}>
            {VERDICT_RU[HERO.verdict]}
          </span>
        </div>
        <div style={{marginTop: 22}}>
          <Bars />
        </div>
      </div>

      {/* Смежные узлы */}
      <div style={{position: 'absolute', left: 1060, top: 566, width: 790}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18}}>
          <span style={{fontFamily: MONO, fontSize: 24, color: MUTED, letterSpacing: 2}}>СМЕЖНЫЕ УЗЛЫ</span>
          <div style={{flex: 1, borderTop: `1.5px solid ${MUTED}`}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {ALSO.map((e) => (
            <Node key={e.id} e={e} />
          ))}
        </div>
      </div>

      {/* Штамп чертежа */}
      <div style={{position: 'absolute', left: 40, right: 40, bottom: 40, height: 64, borderTop: `1.5px solid ${INK}`, display: 'flex', background: PAPER}}>
        <Cell k="объект" v={nameOf(HERO.id)} />
        <Cell k="вердикт" v={VERDICT_RU[HERO.verdict]} color={RED} />
        <Cell k="патч" v={SOURCE.patch} flex={0.7} />
        <Cell k="цифры" v={SOURCE_LINE} flex={3} />
      </div>
    </AbsoluteFill>
  );
};
