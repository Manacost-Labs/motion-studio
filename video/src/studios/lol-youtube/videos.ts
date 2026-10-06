// Ролики студии: каждый — папка lol-<тема>/ с config.ts и строка в VIDEOS (Root.tsx регистрирует их по списку:
// композиции <id>, <id>-thumb и варианты обложки). Конфиг ролика импортирует только ../channel
import type {LolConfig} from './channel';
import {PATCH_26_19_DEMO} from './lol-patch-26-19-demo/config';

export const VIDEOS: LolConfig[] = [
  PATCH_26_19_DEMO, // фрагмент «Патч 26.19» в стиле «Газета» — на одобрение, не для публикации
];
