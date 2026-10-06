// Герой (портрет) и герб класса (class_icon HS-Arena в ассетах стиля, public/brand/arena).
// Неизвестный класс (его ловит yt-qa: games/hearthstone/data/classes.ts → unknownClasses) рисуется как Воин — как раньше
import {CLASS_FALLBACK, classKey, HERO} from '../../data/classes';
import {A} from '../../../../looks/compendium/theme';

const known = (cls: string) => classKey(cls) ?? CLASS_FALLBACK;
export const heroFor = (cls: string) => HERO[known(cls)];
export const crestFor = (cls: string) => A(`class_icon/${known(cls).toLowerCase()}.png`);
