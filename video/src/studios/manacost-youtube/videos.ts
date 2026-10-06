// Ролики студии: каждый — папка yt-<тема>/ с config.ts и строка в VIDEOS (Root.tsx регистрирует их по списку:
// композиции <id>, <id>-thumb и варианты обложки). Новый ролик добавляет scripts/yt-new.mjs: импорт и строку в конце списка.
// Демо и витрины канала (не для публикации) — в motion-showcase/, регистрирует их Root.tsx
import type {YtConfig} from './channel';
import {LEGEND_DECKS_SEP26} from './yt-legend-decks-sep26/config';

export const VIDEOS: YtConfig[] = [
  LEGEND_DECKS_SEP26, // «15 колод для Легенды в сентябре» по статье hs-manacost.ru — черновик, не закреплён
];
