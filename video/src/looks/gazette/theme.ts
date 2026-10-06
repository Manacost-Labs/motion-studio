// Стиль «Газета» (выбран пользователем 04.10 по стиль-кадру B для фрагмента LoL): полоса ежедневной газеты — шапка-логотип,
// линейки, колонки, крупный заголовок с засечками, фото номера с подписью, штамп красной краской, цифры — таблицей.
// Две краски — чёрная и красная, бумага светлая газетная. Без игры: что печатать, приходит пропсами
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadPTSerif} from '@remotion/google-fonts/PTSerif';
import {loadFont as loadOswald} from '@remotion/google-fonts/Oswald';

export const {fontFamily: HEAD} = loadPlayfair('normal', {weights: ['700', '800', '900'], subsets: ['cyrillic', 'latin']});
export const {fontFamily: TEXT} = loadPTSerif('normal', {weights: ['400', '700'], subsets: ['cyrillic', 'latin']});
loadPTSerif('italic', {weights: ['400'], subsets: ['cyrillic', 'latin']});
export const {fontFamily: LABEL} = loadOswald('normal', {weights: ['500', '600', '700'], subsets: ['cyrillic', 'latin']});

// Краски; контраст к бумаге: INK 15,9:1, GREY 7,6:1, RED 5,8:1
export const G = {
  paper: '#F2EFE7',
  ink: '#151515',
  grey: '#4D4B47',
  red: '#B3222A',
};

// Вердикт строки и штампа: усилен — чёрной краской, ослаблен — красной, изменён — серой
export type Verdict = 'buff' | 'nerf' | 'adjust';
export const VERDICT_RU: Record<Verdict, string> = {buff: 'усилен', nerf: 'ослаблен', adjust: 'изменён'};
export const STAMP_INK: Record<Verdict, string> = {buff: G.ink, nerf: G.red, adjust: G.grey};

// Поля полосы (кадр 1920×1080)
export const PAGE = {left: 60, right: 60, top: 36, bottom: 40};
