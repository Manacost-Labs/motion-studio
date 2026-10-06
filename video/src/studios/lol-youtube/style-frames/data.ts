// Данные стиль-кадров «обзор патча 26.19 — изменения чемпионов» (lol-style-a, -b, -c). Один и тот же кадр в трёх стилях —
// пользователь выбирает стиль, а не содержание. Цифры настоящие: разница championFull.json (ru_RU) Data Dragon 16.18.1 → 16.19.1
// (публичные патчи 26.18 → 26.19), сверено 04.10.2026. Это НЕ патчноут: формулировки и причины Riot здесь не взяты, только
// числа из данных. Имена — ru_RU (champions.ts), названия умений и титулы — championFull.json 16.19.1.
// Картинки — public/lol (node scripts/games/lol/lol-assets.mjs Ноктюрн Атрокс Райз --only splash,icon,abilities).
import {staticFile} from 'remotion';
import {CHAMPIONS} from '../../../games/lol/data/champions';
import {DD_VERSION, PATCH, type ChampionId} from '../../../games/lol/data/ids';

export type Verdict = 'buff' | 'nerf' | 'adjust';
export type Key = 'P' | 'Q' | 'W' | 'E' | 'R';
// Одна строка изменения: что (умение или характеристика), было → стало, единица; verdict — в чью пользу именно эта строка
export type Line = {key?: Key; spell?: string; what: string; before: string; after: string; unit: string; verdict: 'buff' | 'nerf'};
export type Entry = {id: ChampionId; title: string; verdict: Verdict; lines: Line[]};

export const SOURCE = {patch: PATCH, prevPatch: '26.18', dd: DD_VERSION, prevDd: '16.18.1'};
export const SOURCE_LINE = `Data Dragon ${SOURCE.prevDd} → ${SOURCE.dd} (патчи ${SOURCE.prevPatch} → ${SOURCE.patch})`;

// Главный герой кадра и два «также изменены»
export const HERO: Entry = {
  id: 'Nocturne',
  title: 'Извечный кошмар',
  verdict: 'nerf',
  lines: [{key: 'R', spell: 'Паранойя', what: 'Перезарядка', before: '140 / 115 / 90', after: '160 / 130 / 100', unit: 'с', verdict: 'nerf'}],
};
// Перезарядка «Паранойи» по рангам (для шкал): было и стало, секунды
export const HERO_RANKS: {rank: number; before: number; after: number}[] = [
  {rank: 1, before: 140, after: 160},
  {rank: 2, before: 115, after: 130},
  {rank: 3, before: 90, after: 100},
];

export const ALSO: Entry[] = [
  {
    id: 'Aatrox',
    title: 'Клинок даркинов',
    verdict: 'buff',
    lines: [{key: 'W', spell: 'Проклятые цепи', what: 'Перезарядка', before: '20 / 18 / 16 / 14 / 12', after: '18 / 16,5 / 15 / 13,5 / 12', unit: 'с', verdict: 'buff'}],
  },
  {
    id: 'Ryze',
    title: 'Рунный маг',
    verdict: 'adjust',
    lines: [
      {what: 'Броня за уровень', before: '4,2', after: '4,7', unit: '', verdict: 'buff'},
      {key: 'E', spell: 'Волшебный поток', what: 'Стоимость', before: '35 / 45 / 55 / 65 / 75', after: '40 / 50 / 60 / 70 / 80', unit: 'маны', verdict: 'nerf'},
    ],
  },
];

export const VERDICT_RU: Record<Verdict, string> = {buff: 'усилен', nerf: 'ослаблен', adjust: 'изменён'};

export const nameOf = (id: ChampionId) => CHAMPIONS[id].ru;
// Базовый образ (номер 0): id образа = key × 1000. Сплэш DD 1215×717 — на экране не шире 910 px в кадре 1080 (≤ 1,5× в 4K)
export const splashOf = (id: ChampionId) => staticFile(`lol/splash/${CHAMPIONS[id].key * 1000}.jpg`);
export const SPLASH = {w: 1215, h: 717};
export const iconOf = (id: ChampionId) => staticFile(`lol/icon/${id}.png`); // 128×128 → не крупнее 96 px
export const abilityOf = (id: ChampionId, key: Key) => staticFile(`lol/ability/${id}/${key}.png`); // 64×64 → не крупнее 64 px
