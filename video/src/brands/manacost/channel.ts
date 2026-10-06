// Канал Манакоста (hs-manacost.ru): имя, сайт, ссылки, логотип, финал роликов, голос и музыка по умолчанию, подвал описания.
// Без игры и стиля: это читают студия manacost-youtube (channel.ts → ctx.brand стиля и каркас ролика) и scripts/yt-export.mjs.
// Типы шаблона сюда не импортируются (brands → только core): формы совпадают с OutroSeg и YtConfig, сверяет tsc в studios/manacost-youtube/channel.ts
import type {BrandLegal} from '../../core/video/types';

export const MANACOST = {
  name: 'Манакост',
  site: 'hs-manacost.ru',
  tg: 't.me/manacost_ru',
  vk: 'vk.com/manacost',
  logo: 'brand/manacost/logo.png', // 321×234, не увеличивать больше ~1,3×
  // для стиля «Компендиум» (looks/compendium/types.ts → CompendiumBrand): персонаж вступления по умолчанию,
  // надпись по кругу сургучной печати топа и пометка №1
  defaultMural: 'brand/arena/home-paladin-hero.webp',
  sealRing: 'Топ-3 · Манакост · ',
  leaderLabel: 'Лидер меты',
};

// Ссылки канала: text — как написано на экране финала, outro — подпись под ней, label и url — строка подвала описания
export const LINKS = [
  {label: 'Сайт', url: 'https://hs-manacost.ru', text: 'hs-manacost.ru', outro: 'полная статья'},
  {label: 'Telegram', url: 'https://t.me/manacost_ru', text: 't.me/manacost_ru', outro: 'новости в Telegram'},
  {label: 'ВКонтакте', url: 'https://vk.com/manacost', text: 'vk.com/manacost', outro: 'группа ВКонтакте'},
];

// Подвал описания YouTube (scripts/yt-export.mjs → description.txt), перед хэштегами
export const descriptionFooter = [`${MANACOST.name}:`, ...LINKS.map((l) => `${l.label} — ${l.url}`)];

// Юридический блок (core/video/types.ts → BrandLegal): оговорка правообладателя в конце описания (yt-export), запрещённые
// в названии канала знаки и в названии и тегах ролика слова (yt-qa), обязательность оговорки к выпуску (release.mjs).
// Для Hearthstone пока не нужен — пусто
export const legal: BrandLegal = {disclaimer: '', policyUrl: '', forbidden: [], required: false};

// Финал Манакоста: итоговая таблица всех колод под первую фразу, на «Подписывайтесь» — конечная заставка YouTube
export const manacostOutro = (opts: {kicker: string; title?: string; vo?: string}) => ({
  kind: 'outro' as const,
  id: 'outro',
  title: 'Удачных игр\nв ладдере!',
  recap: {to: 'Подписывайтесь', kicker: opts.kicker, title: opts.title ?? 'Все колоды подборки'},
  links: LINKS.map((l) => ({text: l.text, label: l.outro})),
  vo:
    opts.vo ??
    'Вот и вся подборка. Коды всех колод — в описании под видео, а полная статья — на нашем сайте. ' +
      'Подписывайтесь на канал и на наш Телеграм, чтобы не пропускать новые подборки. Удачных игр в ладдере!',
});

// Общие настройки всех роликов: музыка-подложка (*-bed.m4a — треки, выровненные под голос: мягкая компрессия, −16 LUFS), 60 к/с, голос Alex Bell (+6 % темпа), без субтитров в кадре
// (только .srt). Произношение — словари игры (games/<игра>/data/pronounce.json) и студии (studios/<студия>/pronounce.json), подмешиваются сами.
// В конфиге: {...YT_BASE, id, title, …, pronounce: {…особые слова ролика}}
export const YT_BASE: {music: string[]; fps: 30 | 60; subtitles: 'auto' | 'on' | 'off'; voice: {id: string; tempo: number}; pronounce: Record<string, string>} = {
  music: ['lib/music/tavern-30-bed.m4a', 'lib/music/mystic-30-bed.m4a'],
  fps: 60,
  subtitles: 'auto',
  voice: {id: 'TUQNWEvVPBLzMBSVDPUA', tempo: 1.06},
  pronounce: {}, // термины игры и бренд — в общих словарях; здесь — только особые слова ролика
};
