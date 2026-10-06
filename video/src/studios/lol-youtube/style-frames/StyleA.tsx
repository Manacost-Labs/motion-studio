// Стиль-кадр A «Атлас»: светлый лист картографа — холодная бумага, горизонтали рельефа, рамка с градусной сеткой,
// сплэш как гравюра-иллюстрация в двойной рамке с подписью, пометки чернилами от руки (только по цифрам из данных).
// Не пергамент «Компендиума»: бумага холодная серо-зелёная, без сукна, сургуча и тёплых бликов. Данные — ./data.ts
import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadAlegreya} from '@remotion/google-fonts/Alegreya';
import {loadFont as loadAlegreyaSC} from '@remotion/google-fonts/AlegreyaSC';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {abilityOf, ALSO, HERO, HERO_RANKS, iconOf, nameOf, SOURCE_LINE, SPLASH, splashOf, VERDICT_RU, type Entry, type Verdict} from './data';

const {fontFamily: TITLE} = loadCormorant('normal', {weights: ['600', '700'], subsets: ['cyrillic', 'latin']});
const {fontFamily: TITLE_I} = loadCormorant('italic', {weights: ['500', '600'], subsets: ['cyrillic', 'latin']});
const {fontFamily: TEXT} = loadAlegreya('normal', {weights: ['400', '500', '700'], subsets: ['cyrillic', 'latin']});
loadAlegreya('italic', {weights: ['400'], subsets: ['cyrillic', 'latin']});
const {fontFamily: CAPS} = loadAlegreyaSC('normal', {weights: ['500', '700'], subsets: ['cyrillic', 'latin']});
const {fontFamily: HAND} = loadCaveat('normal', {weights: ['600', '700'], subsets: ['cyrillic', 'latin']});

// Бумага и чернила; контраст текста к бумаге: INK 12,3:1, MUTED 6:1, зелёные/красные/охра ≥ 5,6:1
const PAPER = '#E8EBE4';
const INK = '#1C2A2E';
const MUTED = '#475A5E';
const LINES = '#C2CCC6'; // горизонтали и сетка — фон, не текст
const VERDICT: Record<Verdict, string> = {buff: '#2C6440', nerf: '#9E3626', adjust: '#7E520C'};

// Горизонтали рельефа: замкнутые «волнистые» кольца вокруг центра — детерминированно, без шума и случайности
const contour = (cx: number, cy: number, r: number, seed: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const rr = r * (1 + 0.09 * Math.sin(3 * t + seed) + 0.05 * Math.sin(5 * t + seed * 1.7) + 0.03 * Math.sin(8 * t - seed));
    pts.push(`${(cx + rr * Math.cos(t) * 1.35).toFixed(1)},${(cy + rr * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};
const RELIEF = [
  ...[60, 110, 160, 210, 260, 310].map((r, i) => contour(380, 830, r, 0.6 + i * 0.25)),
  ...[50, 95, 140, 185].map((r, i) => contour(1700, 900, r, 2.1 + i * 0.3)),
  ...[40, 80, 120].map((r, i) => contour(820, 120, r, 4 + i * 0.2)),
];

// Рамка листа с градусной сеткой: деления по краю и подписи столбцов/строк (украшение, не смысл)
const Sheet: React.FC = () => (
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
    {RELIEF.map((d, i) => (
      <path key={i} d={d} fill="none" stroke={LINES} strokeWidth={1.4} />
    ))}
    <rect x={30} y={30} width={1860} height={1020} fill="none" stroke={INK} strokeWidth={3} />
    <rect x={42} y={42} width={1836} height={996} fill="none" stroke={INK} strokeWidth={1} />
    {Array.from({length: 23}, (_, i) => 42 + (i + 1) * 79.8).map((x, i) => (
      <line key={`t${i}`} x1={x} x2={x} y1={30} y2={i % 2 ? 36 : 42} stroke={INK} strokeWidth={1.5} />
    ))}
    {Array.from({length: 12}, (_, i) => 42 + (i + 1) * 76.6).map((y, i) => (
      <line key={`l${i}`} x1={30} x2={i % 2 ? 36 : 42} y1={y} y2={y} stroke={INK} strokeWidth={1.5} />
    ))}
  </svg>
);

// Подчёркивание от руки: чуть волнистая линия под словом
const Underline: React.FC<{w: number; color: string; style?: React.CSSProperties}> = ({w, color, style}) => (
  <svg width={w} height={18} style={{display: 'block', ...style}}>
    <path d={`M4,11 C${w * 0.3},4 ${w * 0.6},16 ${w - 6},7`} fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
  </svg>
);

// Строка «было → стало»: старое зачёркнуто тонкой линией, новое — крупно
const Change: React.FC<{before: string; after: string; unit: string; size: number}> = ({before, after, unit, size}) => {
  const small = Math.max(26, size * 0.62);
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', fontFamily: TEXT}}>
      <span style={{fontSize: small, color: MUTED, textDecoration: 'line-through', textDecorationThickness: 2}}>{before}</span>
      <span style={{fontSize: small, color: MUTED}}>→</span>
      <span style={{fontSize: size, fontWeight: 700, color: INK}}>
        {after}
        {unit ? <span style={{fontSize: Math.max(26, size * 0.55), fontWeight: 500, color: MUTED}}> {unit}</span> : null}
      </span>
    </div>
  );
};

// «Также на листе» — строка во всю ширину: метка на карте (иконка в кольце), имя и вердикт чернилами, затем изменения
// таблицей «что — было → стало»
const Also: React.FC<{e: Entry}> = ({e}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 26, minHeight: 112}}>
    <div style={{width: 104, height: 104, borderRadius: 52, border: `3px solid ${INK}`, padding: 5, flexShrink: 0}}>
      <Img src={iconOf(e.id)} style={{width: 88, height: 88, borderRadius: 44, display: 'block'}} />
    </div>
    <div style={{width: 300, flexShrink: 0}}>
      <div style={{fontFamily: TITLE, fontWeight: 700, fontSize: 58, color: INK, lineHeight: 1}}>{nameOf(e.id)}</div>
      <div style={{fontFamily: HAND, fontWeight: 700, fontSize: 42, color: VERDICT[e.verdict], transform: 'rotate(-3deg)', transformOrigin: 'left', lineHeight: 1.1}}>{VERDICT_RU[e.verdict]}</div>
    </div>
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 6}}>
      {e.lines.map((l) => (
        <div key={l.what} style={{display: 'flex', alignItems: 'baseline'}}>
          <div style={{width: 470, flexShrink: 0, fontFamily: TEXT, fontSize: 28, color: MUTED}}>
            {l.key ? `${l.key} «${l.spell}» · ` : ''}
            {l.what.toLowerCase()}
            {l.unit === 'с' ? ', с' : ''}
          </div>
          <Change before={l.before} after={l.after} unit={l.unit === 'с' ? '' : l.unit} size={36} />
        </div>
      ))}
    </div>
  </div>
);

const SW = 890; // ширина сплэша на листе: 890 / 1215 → 1,47× в 4K
const SH = Math.round((SW * SPLASH.h) / SPLASH.w);

export const StyleA: React.FC = () => {
  const line = HERO.lines[0];
  const delta = HERO_RANKS.map((r) => r.after - r.before).join(' / ');
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <Sheet />

      {/* Заголовок листа */}
      <div style={{position: 'absolute', left: 96, top: 84, width: 780}}>
        <div style={{fontFamily: CAPS, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: MUTED}}>атлас патча 26.19 · лист I</div>
        <div style={{fontFamily: TITLE, fontWeight: 700, fontSize: 140, lineHeight: 0.95, color: INK, marginTop: 12}}>{nameOf(HERO.id)}</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 28, marginTop: 6}}>
          <span style={{fontFamily: TITLE_I, fontStyle: 'italic', fontWeight: 600, fontSize: 46, color: MUTED}}>{HERO.title}</span>
          <span style={{position: 'relative', display: 'inline-block', transform: 'rotate(-4deg)'}}>
            <span style={{fontFamily: HAND, fontWeight: 700, fontSize: 64, color: VERDICT[HERO.verdict]}}>{VERDICT_RU[HERO.verdict]}</span>
            <Underline w={230} color={VERDICT[HERO.verdict]} style={{position: 'absolute', left: -6, bottom: -6}} />
          </span>
        </div>
      </div>

      {/* Изменение героя */}
      <div style={{position: 'absolute', left: 96, top: 392, width: 800}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <div style={{border: `2px solid ${INK}`, padding: 4}}>
            <Img src={abilityOf(HERO.id, line.key!)} style={{width: 64, height: 64, display: 'block'}} />
          </div>
          <div>
            <div style={{fontFamily: TEXT, fontWeight: 700, fontSize: 44, color: INK, lineHeight: 1.05}}>
              {line.key} · «{line.spell}»
            </div>
            <div style={{fontFamily: TEXT, fontSize: 30, color: MUTED}}>{line.what.toLowerCase()}, с</div>
          </div>
        </div>
        <div style={{marginTop: 22}}>
          <Change before={line.before} after={line.after} unit={line.unit} size={66} />
        </div>
        <div style={{fontFamily: HAND, fontWeight: 600, fontSize: 44, color: VERDICT.nerf, marginTop: 18, transform: 'rotate(-1.5deg)', transformOrigin: 'left'}}>
          ульта откатывается дольше на {delta} с
        </div>
      </div>

      {/* Сплэш — иллюстрация в двойной рамке, целиком */}
      <div style={{position: 'absolute', left: 940, top: 92}}>
        <div style={{border: `3px solid ${INK}`, padding: 9}}>
          <div style={{border: `1px solid ${INK}`, padding: 0, lineHeight: 0}}>
            <Img src={splashOf(HERO.id)} style={{width: SW, height: SH, display: 'block'}} />
          </div>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: TEXT, fontSize: 24, color: MUTED, marginTop: 10}}>
          <span style={{fontStyle: 'italic'}}>Ил. 1. {nameOf(HERO.id)}, базовый образ. Арт — Riot Games</span>
          <span>
            {(['buff', 'nerf', 'adjust'] as Verdict[]).map((v) => (
              <span key={v} style={{marginLeft: 22}}>
                <span style={{color: VERDICT[v]}}>●</span> {VERDICT_RU[v]}
              </span>
            ))}
          </span>
        </div>
        <div style={{fontFamily: TEXT, fontSize: 24, color: MUTED, marginTop: 2}}>Цифры: {SOURCE_LINE}</div>
      </div>

      {/* Рукописная стрелка от изменения к иллюстрации */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path d="M 830 470 C 880 430, 900 400, 948 392" fill="none" stroke={VERDICT.nerf} strokeWidth={3.2} strokeLinecap="round" />
        <path d="M 930 380 L 950 392 L 932 408" fill="none" stroke={VERDICT.nerf} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Также на листе */}
      <div style={{position: 'absolute', left: 96, right: 96, top: 730}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: CAPS, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: MUTED}}>также на листе</span>
          <div style={{flex: 1, height: 0, borderTop: `1.5px dashed ${MUTED}`}} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16}}>
          {ALSO.map((e) => (
            <Also key={e.id} e={e} />
          ))}
        </div>
      </div>

    </AbsoluteFill>
  );
};
