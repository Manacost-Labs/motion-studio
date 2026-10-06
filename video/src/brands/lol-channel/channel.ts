// Канал lol-channel: имя, сайт, ссылки, логотип, финал роликов, голос и музыка по умолчанию, подвал описания, юридический блок.
// Без игры и стиля: это читают студия lol-youtube (channel.ts → ctx стиля и каркас ролика) и scripts/yt-export.mjs, yt-qa.mjs, release.mjs.
// Заготовка — scripts/new-direction.mjs (2026-10-04): поля с TODO заполнить по BRIEF.md студии (навык studio-new-direction, шаги 1 и 3).
// brands → только core (типы); образец — src/brands/manacost/channel.ts
import type {BrandLegal} from '../../core/video/types';

export const BRAND = {
  name: 'TODO название канала', // без товарных знаков правообладателя, если их нельзя (BRIEF.md → «Право»)
  site: 'TODO сайт',
  logo: '', // TODO: картинка из public (brand/lol-channel/logo.png), допустимое увеличение — в BRIEF.md
};

// Ссылки канала: text — как написано на экране финала, outro — подпись под ней, label и url — строка подвала описания (TODO)
export const LINKS: {label: string; url: string; text: string; outro: string}[] = [];

// Подвал описания YouTube (scripts/yt-export.mjs → description.txt), перед хэштегами
export const descriptionFooter = [`${BRAND.name}:`, ...LINKS.map((l) => `${l.label} — ${l.url}`)];

// Юридический блок (core/video/types.ts → BrandLegal): disclaimer — оговорка правообладателя дословно (yt-export дописывает её
// в конец описания), policyUrl — политика правообладателя, required — без оговорки ролик не выпускается (release.mjs ❌).
// Политика Riot для фан-контента — «Legal Jibber Jabber» (пересказ — src/games/lol/GAME.md, «Политика Riot»). Оговорка с TODO
// считается незаданной (scripts/lib/channel.mjs → loadBrand): yt-export её не дописывает, release даёт ❌.
// forbidden — товарные знаки Riot, которых нельзя в названии КАНАЛА: имя и сайт (BRAND), ссылки и подписи финала (LINKS), подвал
// описания (yt-qa ❌). Имена чемпионов в названии канала тоже нельзя — проверяется глазами при выборе имени.
// forbiddenInVideo — слова, выдающие ролик или канал за официальный, в названии, вариантах названия, тегах и хэштегах ролика
// (yt-qa ❌). Назвать игру и чемпионов, чтобы описать ролик («Гайд на Ари | League of Legends»), можно. Только единственное число
// «официальный/-ая/-ое»: «по официальным данным», «официальные цифры» — про источник цифр, это допустимо.
// forbiddenInTags — текст политики Riot запрещает товарные знаки и названия IP Riot как ключевые слова и поисковые теги
// (сверено аудитом 04.10.2026): эти слова в тегах и хэштегах — yt-qa ❌. Имена чемпионов — тоже IP Riot; включать ли их
// в запрет — вопрос пользователю (BRIEF.md студии), пока проверяются глазами
export const legal: BrandLegal = {
  // TODO: вставить официальный текст оговорки Riot дословно со страницы policyUrl (с названием канала) + русский перевод; сам текст не сочинять
  disclaimer: 'TODO: вставить официальный текст оговорки Riot дословно со страницы policyUrl',
  policyUrl: 'https://www.riotgames.com/en/legal',
  forbidden: ['League of Legends', 'LoL', 'Riot'],
  forbiddenInVideo: ['официальный', 'официальная', 'официальное', 'official', 'Riot Games представляет', 'Riot Games presents', 'партнёр Riot', 'партнер Riot', 'от лица Riot'],
  forbiddenInTags: ['League of Legends', 'LoL', 'Riot', 'Riot Games'],
  required: true,
};

// Финал роликов канала: прощание и текст диктора (TODO); сегмент финала собирает канал студии в формате своего стиля
export const OUTRO = {title: 'TODO прощание', vo: 'TODO текст диктора финала: подписка, ссылки'};

// Общие настройки всех роликов канала: музыка-подложка (TODO: треки из public с лицензией в public/lib/manifest.json), частота,
// субтитры, голос, произношение — словари игры и студии. Голос ПОКА Alex Bell, как у Манакоста (src/brands/manacost/channel.ts):
// TODO — решение пользователя по пробам (BRIEF.md → «Голос и звук»); темп — тоже по пробам
export const YT_BASE: {music: string[]; fps: 30 | 60; subtitles: 'auto' | 'on' | 'off'; voice: {id?: string; tempo: number}; pronounce: Record<string, string>} = {
  music: [],
  fps: 60,
  subtitles: 'auto',
  voice: {id: 'TUQNWEvVPBLzMBSVDPUA', tempo: 1}, // Alex Bell (eleven_v4) — временно, до выбора пользователя
  pronounce: {},
};
