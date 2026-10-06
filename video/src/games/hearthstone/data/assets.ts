// Картинки карт Hearthstone в public/hs (качают scripts/fetch-article.mjs и hs-assets.mjs из HearthstoneJSON):
// tiles — полоски для списка колоды, render — карта целиком (ruRU), art — арт (путь без staticFile: для DepthArt и фонов)
import {staticFile} from 'remotion';

export const hsTile = (id: string) => staticFile(`hs/tiles/${id}.png`);
export const hsRender = (id: string) => staticFile(`hs/render/${id}.png`);
export const hsArt = (id: string) => `hs/art/${id}.jpg`;
