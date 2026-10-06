// Изменения чемпионов в патче — данные сцены patch-champion (src/games/lol/scenes/patchChampion.tsx) и картинки Data Dragon.
// Цифры — только из данных (разница championFull.json между версиями Data Dragon или патчноут) с подписью источника (GAME.md, «Цифры»).
// Картинки — public/lol (node scripts/games/lol/lol-assets.mjs <чемпион…> --only splash,icon,abilities)
import {staticFile} from 'remotion';
import {CHAMPIONS} from './champions';
import type {ChampionId} from './ids';

// Вердикт строки: в чью пользу изменение (buff — усиление, nerf — ослабление, adjust — разнонаправленно)
export type PatchVerdict = 'buff' | 'nerf' | 'adjust';
export type AbilityKey = 'P' | 'Q' | 'W' | 'E' | 'R';

// Одна строка изменения: умение (key + spell) или характеристика (только what), было → стало, единица
export type PatchLine = {key?: AbilityKey; spell?: string; what: string; before: string; after: string; unit: string};
// Заметка «также в выпуске»: чемпион, вердикт, строки; at — фраза из vo, на которой заметка появляется
export type PatchBrief = {id: ChampionId; verdict: PatchVerdict; lines: PatchLine[]; at?: string};
// Главная заметка: чемпион и его титул, вердикт (штамп на фразе stampAt), умение и значения по рангам (каждый ранг — на своей фразе)
export type PatchHero = {
  id: ChampionId;
  title: string;
  verdict: PatchVerdict;
  stampAt?: string;
  ability: {key: AbilityKey; spell: string; what: string; unit: string; at?: string};
  ranks: {rank: number; before: string; after: string; at?: string}[];
};

export const nameOf = (id: ChampionId) => CHAMPIONS[id].ru;
// Базовый образ (номер 0): id образа = key × 1000. Сплэш DD 1215×717 — на экране не шире 910 px в кадре 1080 (≤ 1,5× в 4K)
export const splashOf = (id: ChampionId) => staticFile(`lol/splash/${CHAMPIONS[id].key * 1000}.jpg`);
export const SPLASH = {w: 1215, h: 717};
export const iconOf = (id: ChampionId) => staticFile(`lol/icon/${id}.png`); // 128×128 → не крупнее 96 px
export const abilityOf = (id: ChampionId, key: AbilityKey) => staticFile(`lol/ability/${id}/${key}.png`); // 64×64 → не крупнее 64 px
// Файлы для проверки yt-qa (SceneDef.assets): путь в public
export const splashFile = (id: ChampionId) => `lol/splash/${CHAMPIONS[id].key * 1000}.jpg`;
