// Основной ролик HearthPulse: содержимое сцен. Дизайн и поведение — в src/hearthpulse.
// Все тайминги внутри сцен — в долях музыки: b(n) = n-я доля от начала сцены (см. timeline.ts).
import React from 'react';
import {
  BackdropSpec,
  Bg,
  CarouselItem,
  CarouselScene,
  EndCardScene,
  FeatureBackdrop,
  FeatureProps,
  FeatureScene,
  HookScene,
  LogoScene,
  RIGHT_X,
  useFrameSize,
} from '../../../hearthpulse';
import {LIVE, LiveId} from './live';
import {b, BEAT, DUR, FINAL_HIT} from './timeline';

type Scene = Omit<FeatureProps, 'dur'>;

// ─── 1. Хук ───
const HOOK_CARDS = ['CORE_EX1_298', 'JAIL_720', 'CORE_EX1_016', 'CATA_200', 'CORE_RLK_567', 'CORE_CS2_072', 'CORE_EX1_145', 'CORE_EX1_129', 'JAIL_504'];
export const Hook: React.FC<{dur: number}> = ({dur}) => (
  <HookScene dur={dur} kicker="Мета снова изменилась" title={'Чем играть\nпосле патча?'} art="art/naxx.jpg" live={LIVE.hook} cards={HOOK_CARDS} />
);

// ─── 2. Логотип ───
export const Logo: React.FC<{dur: number}> = ({dur}) => <LogoScene dur={dur} />;

// ─── 3. Стандарт: карточки меты, затем «прокрутка страницы» к таблице архетипов ───
const META: [number, number] = [1120, 460];
const WINRATE_BOX: [number, number, number, number] = [855, 28, 238, 128];
const TO_TABLE = b(6);

const STANDARD: Scene = {
  kicker: 'Стандарт · Вольный',
  title: 'Мета и архетипы',
  titleWide: 'Мета и\nархетипы',
  backdrop: {
    art: 'art/emerald.jpg',
    blur: 5,
    dim: 0.86,
    char: {
      v: {src: 'chars/orc.png', h: 1250, side: 'right', offset: -120, bottom: -700, feather: {top: 22, left: 14}},
      h: {src: 'chars/orc.png', h: 760, side: 'left', offset: 60, bottom: -200, feather: {top: 22, left: 14}},
    },
  },
  live: LIVE.standard,
  // В вертикали клип с крупным орком опущен, чтобы голова была ниже карточек меты
  liveOpts: {v: {shift: 560, fadeTop: 20, under: <Bg src="art/emerald.jpg" dur={DUR.standard} blur={5} dim={0.86} />}, h: {}},
  panels: [
    {
      src: 'ui/meta-card-1.png',
      size: META,
      layout: {v: {w: 940, y: 560}, h: {w: 860, x: RIGHT_X, y: 170}},
      delay: b(1),
      exitAt: TO_TABLE,
      exitMode: 'scroll',
      highlights: [{rect: WINRATE_BOX, delay: b(3)}],
    },
    {
      src: 'ui/meta-card-2.png',
      size: META,
      layout: {v: {w: 940, y: 970}, h: {w: 860, x: RIGHT_X, y: 560}},
      delay: b(2),
      exitAt: TO_TABLE,
      exitMode: 'scroll',
      highlights: [{rect: WINRATE_BOX, delay: b(4)}],
    },
    {
      // Таблица архетипов: ~40 строк, снята в 2x из-под аккаунта
      src: 'ui/archetypes-table.png',
      size: [2238, 4800],
      layout: {v: {w: 960, y: 540, viewH: 820}, h: {w: 900, x: RIGHT_X, y: 110, viewH: 860}},
      from: 'scroll',
      delay: TO_TABLE,
      scroll: {start: TO_TABLE + 8, dist: {v: -1200, h: -1050}},
    },
  ],
};
export const Standard: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...STANDARD} />;

// ─── 4. Матчапы: лучший и худший соперник выбранной колоды ───
const MATCHUPS: Scene = {
  kicker: 'Колода против колоды',
  title: 'Матчапы',
  titleSize: 130,
  sub: 'Винрейт против каждого архетипа',
  backdrop: {
    art: 'art/nathria.jpg',
    focus: '62% 45%',
    dim: 0.84,
    char: {
      v: {src: 'chars/warlock.png', h: 900, side: 'right', offset: -200, bottom: -60},
      h: {src: 'chars/warlock.png', h: 700, side: 'left', offset: 40, bottom: -60},
    },
  },
  panels: [
    {
      src: 'ui/matchups.png',
      size: [2238, 1328],
      layout: {v: {w: 980, y: 640}, h: {w: 1000, x: RIGHT_X + 20, y: 240}},
      delay: b(1),
      highlights: [
        {rect: [80, 530, 650, 84], delay: b(3)}, // лучший: Квест Шаман 83,3%
        {rect: [1550, 530, 660, 84], delay: b(5)}, // сложный: Чистый Паладин 47,7%
      ],
    },
  ],
};
export const Matchups: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...MATCHUPS} />;

// ─── 5. Карты: курсор наводится на карту — появляется её статистика (как на сайте) ───
const CARDS_BACKDROP: BackdropSpec = {
  art: 'art/rastakhan.jpg',
  blur: 6,
  dim: 0.86,
  char: {
    v: {src: 'chars/rogue.png', h: 900, side: 'left', offset: -260, bottom: -40, delay: 30},
    h: {src: 'chars/rogue.png', h: 620, side: 'left', offset: 40, bottom: -40, delay: 30},
  },
};
const HOVER: [number, number] = [1040, 736];

const CARDS: Scene = {
  kicker: 'Галерея карт',
  title: 'Статистика\nкаждой карты',
  titleSize: 100,
  backdrop: CARDS_BACKDROP,
  live: LIVE.cards,
  panels: [
    {
      src: 'ui/cards-nohover.png',
      size: HOVER,
      layout: {v: {w: 1000, y: 560}, h: {w: 960, x: RIGHT_X, y: 230}},
      delay: b(0.5),
      zoom: [0, DUR.cards, 1.04, 0, '40% 50%'],
      hover: {
        at: b(3),
        cursor: [190, 300],
        layers: [
          {src: 'ui/cards-hover-card.png', rect: [0, 0, 370, 736]},
          {src: 'ui/cards-hover-popup.png', rect: [370, 104, 640, 624], pop: true},
        ],
      },
      highlights: [
        {rect: [405, 418, 590, 54], delay: b(5)}, // Победы при розыгрыше
        {rect: [405, 556, 590, 56], delay: b(6)}, // Оставлено на старте
      ],
    },
  ],
};
export const Cards: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...CARDS} />;

// ─── 6. Арена: винрейты всех классов, затем «прокрутка» к легендаркам ───
const ARENA: Scene = {
  kicker: 'Классы · Тир-лист · Легендарки',
  title: 'Арена',
  titleSize: 130,
  backdrop: {
    art: 'art/frozen-throne.jpg',
    focus: '45% 50%',
    dim: 0.78,
    char: {
      v: {src: 'chars/dk.png', h: 1050, side: 'left', offset: -330, bottom: -30},
      h: {src: 'chars/dk.png', h: 720, side: 'left', offset: -60, bottom: -40},
    },
  },
  live: LIVE.arena,
  liveOpts: {v: {grade: 0.3}, h: {}},
  panels: [
    {
      src: 'ui/arena-classes.png',
      size: [2238, 1626],
      // В горизонтали ниже строки надзаголовка: он длинный и доходит до x ≈ 1030
      layout: {v: {w: 980, y: 540}, h: {w: 860, x: 1400, y: 270}},
      delay: b(1),
      exitAt: b(6),
      exitMode: 'scroll',
      highlights: [{rect: [8, 20, 2222, 180], delay: b(3)}],
    },
    {
      src: 'ui/arena-legendaries.png',
      size: [2238, 2280],
      layout: {v: {w: 980, y: 540, viewH: 760}, h: {w: 860, x: 1400, y: 270, viewH: 700}},
      from: 'scroll',
      delay: b(6),
      scroll: {start: b(7), dist: {v: -238, h: -176}},
      highlights: [{rect: [10, 16, 712, 1080], delay: b(10.5)}],
    },
  ],
};
export const Arena: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...ARENA} />;

// ─── 7. Поля сражений: длинная прокрутка героев (тир A) и тир-листа стратегий ───
const BATTLEGROUNDS: Scene = {
  kicker: 'Герои · Существа · Стратегии',
  title: 'Поля сражений',
  titleWide: 'Поля\nсражений',
  backdrop: {
    art: 'art/gvg.jpg',
    focus: '40% 50%',
    dim: 0.8,
    char: {
      v: {src: 'chars/dwarf.png', h: 860, side: 'right', offset: -170, bottom: -40, delay: 6},
      h: {src: 'chars/dwarf.png', h: 640, side: 'left', offset: 60, bottom: -30, delay: 6},
    },
  },
  live: LIVE.bg,
  panels: [
    {
      src: 'ui/bg-heroes.png',
      size: [2142, 3800],
      layout: {v: {w: 1000, y: 540, viewH: 520}, h: {w: 960, x: 1410, y: 90, viewH: 470}},
      delay: b(1),
      reveal: true,
      scroll: {start: b(2), dist: {v: -1200, h: -1180}},
    },
    {
      src: 'ui/bg-strategies.png',
      size: [2034, 3282],
      layout: {v: {w: 720, x: 430, y: 1110, viewH: 420}, h: {w: 900, x: 1390, y: 600, viewH: 420}},
      delay: b(4),
      from: 'right',
      scroll: {start: b(7), dist: {v: -600, h: -700}},
      highlights: [{rect: [26, 136, 994, 560], delay: b(6)}],
    },
  ],
};
export const Battlegrounds: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...BATTLEGROUNDS} />;

// ─── 8. Существо Полей сражений: карточка с цифрами → прокрутка к графикам по раундам ───
const MINION: [number, number] = [2142, 2706];
const minionDist = (w: number, viewH: number) => viewH - (w * MINION[1]) / MINION[0];

const MINION_SCENE: Scene = {
  kicker: 'Поля сражений',
  title: 'Каждое существо',
  titleWide: 'Каждое\nсущество',
  sub: 'Влияние по раундам и винрейт в боях',
  backdrop: {
    art: 'art/furbolg.jpg',
    focus: '50% 45%',
    dim: 0.84,
    char: {
      v: {src: 'chars/tauren.png', h: 820, side: 'right', offset: -170, bottom: -40},
      h: {src: 'chars/tauren.png', h: 640, side: 'left', offset: 40, bottom: -30},
    },
  },
  panels: [
    {
      src: 'ui/bg-minion.png',
      size: MINION,
      layout: {v: {w: 980, y: 560, viewH: 760}, h: {w: 900, x: RIGHT_X + 30, y: 150, viewH: 800}},
      delay: b(0.5),
      scroll: {start: b(3), end: b(7), dist: {v: minionDist(980, 760), h: minionDist(900, 800)}},
      highlights: [
        {rect: [764, 916, 1304, 210], delay: b(1.5)}, // Импакт, среднее место, популярность
        {rect: [1088, 1512, 1002, 580], delay: b(6)}, // график «Доля побед в боях»
      ],
    },
  ],
};
export const Minion: React.FC<{dur: number}> = ({dur}) => <FeatureScene dur={dur} {...MINION_SCENE} />;

// ─── 9. «И ещё» ───
const MONTAGE: CarouselItem[] = [
  {src: 'ui/fundecks.png', size: [2268, 1168], title: 'Фан-колоды', sub: 'Необычные сборки с кодами колод'},
  {src: 'ui/vs-gold.png', size: [2238, 4074], title: 'VS Gold', sub: 'Расширенная мета от Vicious Syndicate'},
  {src: 'ui/articles.png', size: [2268, 1624], title: 'Статьи и гайды', sub: 'Мета-отчёты и разборы патчей'},
  {src: 'ui/cosmetics.png', size: [2268, 2000], title: 'Косметика', sub: 'Скины героев, монеты и питомцы'},
];
export const Montage: React.FC<{dur: number}> = ({dur}) => <CarouselScene dur={dur} items={MONTAGE} />;

// ─── 10. Финал: цена встаёт на финальный удар музыки ───
export const End: React.FC<{dur: number}> = ({dur}) => <EndCardScene dur={dur} live={LIVE.end} priceAt={FINAL_HIT} beat={BEAT} />;

// ─── Стартовые кадры для Higgsfield: композиции plate-*, номер кадра задаёт scripts/plates.mjs ───
export const Plate: React.FC<{id: LiveId}> = ({id}) => {
  const {wide} = useFrameSize();
  switch (id) {
    case 'hook':
      return <Bg src="art/naxx.jpg" dur={1} from={1.05} to={1.05} focus={wide ? '50% 45%' : '52% 40%'} raw />;
    case 'standard':
      return <FeatureBackdrop dur={150} {...STANDARD.backdrop} />;
    case 'cards':
      return <FeatureBackdrop dur={120} {...CARDS_BACKDROP} />;
    case 'arena':
      return <FeatureBackdrop dur={150} {...ARENA.backdrop} />;
    case 'bg':
      return <FeatureBackdrop dur={120} {...BATTLEGROUNDS.backdrop} />;
    case 'end':
      // Уже размытый и затемнённый: чистый арт модель отклоняет по авторским правам
      return <Bg src="art/badlands.jpg" dur={1} from={1.08} to={1.08} focus={wide ? '50% 45%' : '50% 40%'} blur={3} dim={0.72} />;
  }
};
