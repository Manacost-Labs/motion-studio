// Новое направление студии одной командой (навык studio-new-direction, «Команда-скаффолд»):
//   node scripts/new-direction.mjs --key <ключ> --dir <канал>-<площадка> --game <игра> --brand <канал>
//        --look <compendium | new:<имя>> --prefix <префикс>- --port <порт> [--title "<название студии>"] [--dry]
// Создаёт (ничего не перезаписывает):
//   1) строку в src/studios/studios.json (kind youtube, freeze golden);
//   2) src/studios/<dir>/: index.ts, Root.tsx (ролики из videos.ts, обложка-заглушка, витрина-заглушка <prefix>showcase),
//      videos.ts (пустой список), channel.ts
//      (defineChannel: стиль, бренд, игра, сцены — сцены готового стиля и игры; у нового стиля — пустой список с TODO),
//      README.md (паспорт), pronounce.json, BRIEF.md (шаблон навыка);
//   3) игры ещё нет — src/games/<game>/ (GAME.md, data/pronounce.json, data/types.ts, scenes/index.ts) и scripts/games/<game>/README.md;
//   4) бренда ещё нет — src/brands/<brand>/channel.ts с TODO: имя, ссылки, логотип, финал, голос, музыка, legal;
//   5) --look new:<имя> — src/looks/<имя>/: README.md, look.tsx (стиль-заглушка: ровный фон, без перехода, простые субтитры)
//      и showcase/README.md (витрина-заглушка) — код чужого стиля не копируется;
//   6) строку "studio:<key>" в package.json (порт) — единственная правка package.json;
//   7) заготовку навыка .claude/skills/<dir>/SKILL.md и вкуса video/taste/<key>.md (если их ещё нет).
// Ключ или папка студии уже есть — ошибка, ничего не пишется. Сбой посреди записи — записанное убирается, реестр и
// package.json возвращаются как были. --dry — только план. В конце — «Дальше: …» (чек-лист навыка).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ROOT, VIDEO} from './lib/paths.mjs';
import {REGISTRY, STUDIOS, STUDIOS_DIR} from './lib/studios.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const USAGE =
  'node scripts/new-direction.mjs --key <ключ> --dir <канал>-<площадка> --game <игра> --brand <канал> --look <compendium | new:<имя>> --prefix <префикс>- --port <порт> [--title "<название>"] [--dry]';
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const dry = args.includes('--dry');
const key = opt('key');
const dir = opt('dir');
const game = opt('game');
const brand = opt('brand');
const lookArg = opt('look');
const prefix = opt('prefix');
const port = Number(opt('port'));
if (!key || !dir || !game || !brand || !lookArg || !prefix || !opt('port')) fail(`не хватает параметров:\n  ${USAGE}`);

// ── Проверки до записи: ни один файл не пишется, пока не ясно, что всё создаётся ──
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
for (const [n, v] of [['key', key], ['dir', dir], ['game', game], ['brand', brand]]) if (!NAME.test(v)) fail(`--${n} «${v}»: латиница в нижнем регистре, цифры, дефис`);
const newLook = lookArg.startsWith('new:');
const look = newLook ? lookArg.slice(4) : lookArg;
if (!NAME.test(look)) fail(`--look «${lookArg}»: compendium (готовый стиль из src/looks) или new:<имя> (имя латиницей)`);
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*-$/.test(prefix)) fail(`--prefix «${prefix}»: латиница с дефисом на конце, например lol-`);
if (!Number.isInteger(port) || port < 1024 || port > 65535) fail(`--port «${opt('port')}»: целое число 1024–65535`);
if (brand === 'hearthpulse') fail('бренд hearthpulse — реклама (src/hearthpulse), не YouTube-канал: укажи бренд канала');

const pkgFile = path.join(VIDEO, 'package.json');
const pkgText = fs.readFileSync(pkgFile, 'utf8');
const pkg = JSON.parse(pkgText);
const scriptName = `studio:${key}`;
const busyPorts = new Set([...STUDIOS.map((s) => s.port), ...Object.values(pkg.scripts ?? {}).flatMap((c) => [...String(c).matchAll(/--port\s+(\d+)/g)].map((m) => Number(m[1])))]);
const studioPath = path.join(STUDIOS_DIR, dir);
const conflicts = [
  STUDIOS.some((s) => s.key === key) && `ключ «${key}» уже есть в src/studios/studios.json`,
  STUDIOS.some((s) => s.dir === dir) && `папка «${dir}» уже есть в src/studios/studios.json`,
  fs.existsSync(studioPath) && `папка src/studios/${dir} уже существует`,
  pkg.scripts?.[scriptName] && `в package.json уже есть «${scriptName}»`,
  STUDIOS.some((s) => s.idPrefix === prefix) && `префикс id «${prefix}» уже у студии ${STUDIOS.find((s) => s.idPrefix === prefix).key}`,
  busyPorts.has(port) && `порт ${port} занят другой студией (studios.json / package.json) — следующий свободный: ${nextPort()}`,
].filter(Boolean);
function nextPort() {
  let p = 3003;
  while (busyPorts.has(p)) p++;
  return p;
}
if (conflicts.length) fail(`направление не заведено — скаффолд ничего не перезаписывает:\n  - ${conflicts.join('\n  - ')}\nПравить существующую студию — руками (навык studio-new-direction); заново — сначала убрать её строку из studios.json, папку и строку в package.json.`);

const lookDir = path.join(VIDEO, 'src', 'looks', look);
if (newLook && fs.existsSync(lookDir)) fail(`стиль src/looks/${look} уже есть — укажи --look ${look} (new: — только для нового стиля)`);
if (!newLook && !fs.existsSync(path.join(lookDir, 'look.tsx'))) fail(`нет готового стиля src/looks/${look}/look.tsx — укажи существующий (${fs.readdirSync(path.join(VIDEO, 'src', 'looks')).join(', ')}) или new:${look}`);

// ── Что уже есть в общих слоях: экспорты модулей (сцены, стиль, бренд) — сборкой esbuild в Node, как scripts/lib/channel.mjs ──
const req = createRequire(import.meta.url);
const inspect = async (file, name) => {
  const outfile = path.join(VIDEO, 'node_modules', '.cache', `new-direction-${name}.cjs`);
  await build({entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error'});
  delete req.cache[outfile];
  return req(outfile);
};
// сцены модуля: экспорты-описания сцен (SceneDef: kind + Component) → [{name, kind}]
const scenesOf = async (file, name) => {
  if (!fs.existsSync(file)) return [];
  const mod = await inspect(file, name);
  return Object.entries(mod)
    .filter(([, v]) => v && typeof v === 'object' && typeof v.kind === 'string' && typeof v.Component === 'function')
    .map(([n, v]) => ({name: n, kind: v.kind}));
};
const gameDir = path.join(VIDEO, 'src', 'games', game);
const brandFile = path.join(VIDEO, 'src', 'brands', brand, 'channel.ts');
const hasGame = fs.existsSync(gameDir);
const hasBrand = fs.existsSync(brandFile);
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (s) => camel(s)[0].toUpperCase() + camel(s).slice(1);
const P = pascal(key);
const CONFIG = `${P}Config`;

let lookExport = camel(look);
let lookScenes = [];
let gameScenes = [];
if (!newLook) {
  const mod = await inspect(path.join(lookDir, 'look.tsx'), `look-${look}`);
  const found = Object.entries(mod).find(([, v]) => v && typeof v === 'object' && v.Backdrop && v.Frame && v.Subtitles);
  if (!found) fail(`src/looks/${look}/look.tsx не экспортирует стиль VoicedLook (Backdrop, Frame, Subtitles) — это не стиль ролика под голос`);
  lookExport = found[0];
  lookScenes = await scenesOf(path.join(lookDir, 'scenes', 'index.ts'), `scenes-${look}`);
  gameScenes = await scenesOf(path.join(gameDir, 'scenes', 'index.ts'), `scenes-${game}`);
}
// сцена игры важнее сцены стиля того же вида (два SceneDef одного kind defineChannel не примет)
const gameKinds = new Set(gameScenes.map((s) => s.kind));
const lookUsed = lookScenes.filter((s) => !gameKinds.has(s.kind));
const lookDropped = lookScenes.filter((s) => gameKinds.has(s.kind));
// бренд для ctx стиля «Компендиум» (CompendiumBrand: name, site, logo): у нового бренда — BRAND, у готового — его экспорт
let brandConst = 'BRAND';
if (hasBrand) {
  const mod = await inspect(brandFile, `brand-${brand}`);
  brandConst = Object.entries(mod).find(([, v]) => v && typeof v === 'object' && 'name' in v && 'site' in v && 'logo' in v)?.[0] ?? null;
}
const gamePronounce = path.join(gameDir, 'data', 'pronounce.json');
const withGamePronounce = !hasGame || fs.existsSync(gamePronounce);

// ── Тексты файлов ──
const today = new Date().toISOString().slice(0, 10);
const title = opt('title') ?? `YouTube ${brand} · ${game}`;
const rel = (f) => path.relative(VIDEO, f).replace(/\\/g, '/');
const fill = (text) =>
  text
    .replace(/<dir>/g, dir)
    .replace(/<ключ>/g, key)
    .replace(/<игра>/g, game)
    .replace(/<канал>/g, brand)
    .replace(/<prefix>/g, prefix)
    .replace(/<стиль>/g, look)
    .replace(/<Направление>|<направление>/g, title);
const templates = path.join(ROOT, '.claude', 'skills', 'studio-new-direction', 'templates');
const template = (name) => fill(fs.readFileSync(path.join(templates, name), 'utf8'));
const compendiumCtx = !newLook && look === 'compendium';

const files = new Map(); // абсолютный путь → текст
const put = (f, text) => files.set(f, text);

// 2) студия
put(
  path.join(studioPath, 'index.ts'),
  `import {registerRoot} from 'remotion';
import {Root} from './Root';

registerRoot(Root);
`,
);
put(
  path.join(studioPath, 'Root.tsx'),
  `// Студия «${title}»: npm run ${scriptName}. Канал (стиль, бренд, игра, сцены) — ./channel.ts, ролики — ./videos.ts,
// паспорт студии — ./README.md, бриф — ./BRIEF.md. Заготовка — scripts/new-direction.mjs. Реестр студий — ../README.md
import React from 'react';
import {AbsoluteFill, Folder, Still} from 'remotion';
import {voicedCompositions} from '../../core/video/compositions';
import {channel, type ${CONFIG}} from './channel';
import {VIDEOS} from './videos';

// Обложка 1280×720 — ЗАГЛУШКА до стиль-кадров (навык studio-new-direction, шаги 4–5): название ролика на ровном фоне
const Thumb: React.FC<{config: ${CONFIG}}> = ({config}) => (
  <AbsoluteFill style={{background: '#ece6da', color: '#2b2621', justifyContent: 'center', alignItems: 'center', padding: 80, fontFamily: 'sans-serif', fontSize: 72, textAlign: 'center', whiteSpace: 'pre-line'}}>
    {config.thumb.title}
  </AbsoluteFill>
);
// Композиция ролика <id> (16:9, под голос) и обложки <id>-thumb, -thumb-b, -thumb-c (core/video/compositions.tsx)
const Compositions = voicedCompositions<${CONFIG}>(channel, Thumb);

// Витрина стиля — ЗАГЛУШКА: фон стиля канала и подпись. Сюда — пробные стиль-кадры (шаг 4: npx remotion still … ${prefix}showcase),
// потом витрина приёмов стиля. Не для публикации; в слепки yt-snap не входит (showcase в id)
const {Backdrop} = channel.look;
const Showcase: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', fontSize: 56, color: '#2b2621'}}>${title.replace(/[{}<>]/g, '')} · стиль-кадры — TODO</AbsoluteFill>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    {/* Ролики канала — ./videos.ts */}
    {VIDEOS.map((config) => (
      <Folder key={config.id} name={config.id}>
        <Compositions config={config} />
      </Folder>
    ))}

    {/* Витрина стиля (не для публикации) */}
    <Folder name="showcase">
      <Still id="${prefix}showcase" component={Showcase} width={1920} height={1080} />
    </Folder>
  </>
);
`,
);
put(
  path.join(studioPath, 'videos.ts'),
  `// Ролики студии: каждый — папка ${prefix}<тема>/ с config.ts и строка в VIDEOS (Root.tsx регистрирует их по списку:
// композиции <id>, <id>-thumb и варианты обложки). Конфиг ролика импортирует только ../channel
import type {${CONFIG}} from './channel';

export const VIDEOS: ${CONFIG}[] = [
];
`,
);
const sceneLines = [
  ...gameScenes.map((s) => s.name),
  ...lookUsed.map((s) => s.name),
];
const channelImports = [
  `import {defineChannel, fields, type ConfigOf, type SegOf} from '../../core/video/registry';`,
  `import {VIDEO_LIMITS} from '../../core/qa/limits';`,
  `import {${lookExport}} from '../../looks/${look}/look';`,
  ...(compendiumCtx ? [`import type {CompendiumCtx} from '../../looks/compendium/types';`] : []),
  ...(lookUsed.length ? [`import {${lookUsed.map((s) => s.name).join(', ')}} from '../../looks/${look}/scenes';`] : []),
  ...(gameScenes.length ? [`import {${gameScenes.map((s) => s.name).join(', ')}} from '../../games/${game}/scenes';`] : []),
  ...(compendiumCtx && brandConst ? [`import {${brandConst}} from '../../brands/${brand}/channel';`] : []),
  ...(withGamePronounce ? [`import GAME_PRONOUNCE from '../../games/${game}/data/pronounce.json';`] : []),
  `import STUDIO_PRONOUNCE from './pronounce.json';`,
];
const contextCode = compendiumCtx
  ? brandConst
    ? `  // ctx сцен стиля «Компендиум» (CompendiumCtx): бренд канала; места топа, гербы и строки итоговой таблицы — от игры, когда понадобятся
  context: (): CompendiumCtx => ({brand: ${brandConst}}),`
    : `  // ctx сцен стиля «Компендиум» (CompendiumCtx): TODO бренд канала {name, site, logo} — из src/brands/${brand}/channel.ts
  context: (): CompendiumCtx => ({brand: {name: '', site: '', logo: ''}}),`
  : `  // ctx сцен (общее для сцен ролика: бренд, места, гербы…) — TODO: что сценам стиля и игры нужно от канала
  context: () => ({}),`;
const scenesCode = sceneLines.length
  ? `  // виды сцен канала: сцены игры (src/games/${game}/scenes)${lookUsed.length ? ` и стиля (src/looks/${look}/scenes)` : ''}${lookDropped.length ? `; ${lookDropped.map((s) => s.kind).join(', ')} стиля заменены сценами игры того же вида` : ''}
  scenes: [${sceneLines.join(', ')}],`
  : `  // TODO: сцен пока нет — новый стиль строится после стиль-кадров и «да» пользователя (навык studio-new-direction, шаги 4–5):
  // сцена без игры — src/looks/${look}/scenes, с игрой — src/games/${game}/scenes (компонент + defineScene), затем строка здесь
  scenes: [],`;
put(
  path.join(studioPath, 'channel.ts'),
  `// Канал «${title}»: стиль ${look} (src/looks/${look}), бренд ${brand} (src/brands/${brand}), игра ${game} (src/games/${game})
// и все виды сцен канала. Отсюда — тип конфига ролика (${CONFIG} = ConfigOf<typeof channel>), пороги проверок (LIMITS) и проверки
// канала (qa → core/qa/audit.ts). Регистрация композиций — ./Root.tsx. Заготовка — scripts/new-direction.mjs (${today});
// образец сборки — src/studios/manacost-youtube/channel.ts (смотреть, не импортировать).
// Новая сцена = файл сцены (компонент + defineScene): без игры — src/looks/${look}/scenes, с игрой — src/games/${game}/scenes;
// + строка в scenes ниже
${channelImports.join('\n')}

// Обложка (Root.tsx → Thumb): TODO — поля обложки направления после стиль-кадров; пока только надпись
export type ${P}ThumbSpec = {title: string};

// Описание и поиск YouTube (yt-export, проверка — yt-qa): lead — первая строка описания, hashtags — до трёх, без «#»,
// tags — теги (→ tags.txt; слова из legal.forbiddenInVideo и legal.forbiddenInTags бренда — ❌), titles — варианты названия (→ titles.txt), playlist, pinnedComment
export type ${P}Seo = {lead: string; hashtags?: string[]; tags?: string[]; titles?: string[]; playlist?: string; pinnedComment?: string};

// Поля конфига канала сверх голоса (VoicedConfig, core/video/types.ts)
export type ${P}Fields = {
  title: string; // название ролика на YouTube (слова из legal.forbiddenInVideo бренда — ❌)
  url?: string; // источник
  thumb: ${P}ThumbSpec;
  thumbs?: Partial<${P}ThumbSpec>[]; // ещё до двух вариантов обложки (B, C)
  seo?: ${P}Seo;
};

export const channel = defineChannel({
  look: ${lookExport},
  brand: '${brand}',
  game: '${game}',
${contextCode}
  fields: fields<${P}Fields>(),
${scenesCode}
  // проверки канала (yt-qa): словарь игры, поверх него — словарь бренда ./pronounce.json; проверки игры (обложка, данные) — TODO
  qa: {pronounce: {${withGamePronounce ? '...GAME_PRONOUNCE, ' : ''}...STUDIO_PRONOUNCE}${withGamePronounce ? `, pronounceFile: 'src/games/${game}/data/pronounce.json'` : ''}},
});

// Конфиг ролика канала: голос (VoicedConfig) + поля канала + сегменты только тех видов, что есть в scenes
export type ${CONFIG} = ConfigOf<typeof channel>;
export type ${P}Segment = SegOf<typeof channel>;

// ─── Пороги проверок роликов канала — для yt-qa, release.mjs, yt-thumb.mjs ───
// общие (субтитры, SEO, темп, файл, обложки) — core/qa/limits.ts; свои пороги канала и игры — здесь (TODO по брифу)
export const LIMITS = {
  // ── Удержание (release.mjs) ──
  hookSec: 8, // сильное начало длиннее — ⚠
  firstDeckSec: 20, // суть ролика начинается позже — ⚠ (имя порога — от первого направления)
  idleSec: 8, // сцена без нового на экране дольше — ⚠

  // ── Права ──
  clipAgeDays: 60, // источник врезки старше ролика на столько дней — ⚠

  // ── Общие: субтитры, описание и SEO, темп, файл к загрузке, обложки (core/qa/limits.ts) ──
  ...VIDEO_LIMITS,
};
`,
);
put(path.join(studioPath, 'pronounce.json'), '{}\n');
put(path.join(studioPath, 'BRIEF.md'), template('BRIEF.md'));
put(
  path.join(studioPath, 'README.md'),
  `# Студия «${title}»

Заготовка направления — \`scripts/new-direction.mjs\` (${today}). Порядок работы — чек-лист навыка \`studio-new-direction\`; когда навык направления заполнен — он (\`.claude/skills/${dir}/SKILL.md\`). Бриф — \`BRIEF.md\` рядом.

## Паспорт студии

Ключ \`${key}\` в \`src/studios/studios.json\` (игра \`${game}\`, стиль \`${look}\`, бренд \`${brand}\`, id роликов \`${prefix}…\`, эталоны — \`golden\`), запуск — \`npm run ${scriptName}\` (порт ${port}). В папке студии только:

| Файл | Что |
|---|---|
| \`channel.ts\` | канал: стиль, бренд, игра, виды сцен (\`defineChannel\`), ctx сцен, тип конфига \`${CONFIG}\`, пороги \`LIMITS\`, проверки канала \`qa\` |
| \`videos.ts\` | список роликов \`VIDEOS\` — строка на ролик |
| \`Root.tsx\`, \`index.ts\` | регистрация роликов из \`videos.ts\` (\`voicedCompositions\`, \`src/core/video/compositions.tsx\`); обложка — заглушка до стиль-кадров |
| \`pronounce.json\` | словарь бренда канала${withGamePronounce ? ` (термины игры — \`src/games/${game}/data/pronounce.json\`)` : ''} |
| \`BRIEF.md\` | бриф направления: канал, форматы, голос, данные, право, решения пользователя |
| \`${prefix}<тема>/\` | ролик: \`config.ts\` (импортирует только \`../channel\`) |

Остальное — в общих слоях: движок под голос и проверки — \`src/core\`; стиль — \`src/looks/${look}\`; игра — \`src/games/${game}\`${!hasGame || fs.existsSync(path.join(gameDir, 'GAME.md')) ? ` (\`GAME.md\`)` : ''}; имя, ссылки, финал, голос, музыка и юридический блок \`legal\` канала — \`src/brands/${brand}/channel.ts\`. Правила импортов — \`scripts/check-layers.mjs\`.

## Статус

Заготовка: сцен${sceneLines.length ? ` — ${sceneLines.length} (${sceneLines.join(', ')})` : ' нет'}, роликов нет. Вкус направления — \`video/taste/${key}.md\`.
`,
);

// 3) игра
if (!hasGame) {
  put(path.join(gameDir, 'GAME.md'), template('GAME.md').replace(/<название>/g, game));
  put(path.join(gameDir, 'data', 'pronounce.json'), '{}\n');
  put(
    path.join(gameDir, 'data', 'types.ts'),
    `// Типы данных игры ${game}: id сущностей, записи загрузчика. Заготовка — scripts/new-direction.mjs.
// TODO: сгенерированные id (data/ids.ts) пишет загрузчик scripts/games/${game}/ из закреплённой версии данных (GAME.md, «Источники»).
// data/ импортирует только src/core и себя (scripts/check-layers.mjs)
export type ${pascal(game)}Version = string; // закреплённая версия данных игры (не latest)
`,
  );
  put(
    path.join(gameDir, 'scenes', 'index.ts'),
    `// Сцены игры ${game}: у каждой — компонент и правила (SceneDef, core/video/registry.ts) в её файле; канал перечисляет нужные
// в своём channel.ts (studios/<студия>/channel.ts). Сцен пока нет: сначала стиль-кадры и «да» пользователя (навык studio-new-direction, шаги 4–5).
// TODO: export {<сцена>} from './<сцена>';
export {};
`,
  );
  put(
    path.join(VIDEO, 'scripts', 'games', game, 'README.md'),
    `# Загрузчики игры ${game}

Скрипты данных и ассетов игры ${game}: снимок данных в кэш вне git, сгенерированные \`src/games/${game}/data/ids.ts\`, картинки в \`public/${game}/\`.
Источники, версии и право — \`src/games/${game}/GAME.md\`. Образец — \`scripts/games/lol/\` (\`lol-data.mjs\` с самопроверкой \`--check\`).

TODO: загрузчик (\`${game}-data.mjs\`): закреплённая версия, кэш, генерация id, самопроверка.
`,
  );
}

// 4) бренд
if (!hasBrand) {
  put(
    brandFile,
    `// Канал ${brand}: имя, сайт, ссылки, логотип, финал роликов, голос и музыка по умолчанию, подвал описания, юридический блок.
// Без игры и стиля: это читают студия ${dir} (channel.ts → ctx стиля и каркас ролика) и scripts/yt-export.mjs, yt-qa.mjs, release.mjs.
// Заготовка — scripts/new-direction.mjs (${today}): поля с TODO заполнить по BRIEF.md студии (навык studio-new-direction, шаги 1 и 3).
// brands → только core (типы); образец — src/brands/manacost/channel.ts
import type {BrandLegal} from '../../core/video/types';

export const BRAND = {
  name: 'TODO название канала', // без товарных знаков правообладателя, если их нельзя (BRIEF.md → «Право»)
  site: 'TODO сайт',
  logo: '', // TODO: картинка из public (brand/${brand}/logo.png), допустимое увеличение — в BRIEF.md
};

// Ссылки канала: text — как написано на экране финала, outro — подпись под ней, label и url — строка подвала описания (TODO)
export const LINKS: {label: string; url: string; text: string; outro: string}[] = [];

// Подвал описания YouTube (scripts/yt-export.mjs → description.txt), перед хэштегами
export const descriptionFooter = [\`\${BRAND.name}:\`, ...LINKS.map((l) => \`\${l.label} — \${l.url}\`)];

// Юридический блок (core/video/types.ts → BrandLegal): disclaimer — оговорка правообладателя дословно (yt-export дописывает её
// в конец описания), policyUrl — политика правообладателя, forbidden — товарные знаки, которых нельзя в названии КАНАЛА (имя, сайт,
// ссылки и подписи финала, подвал описания; yt-qa ❌), forbiddenInVideo — слова, выдающие ролик за официальный, в названии и тегах
// ролика (yt-qa ❌), required — без оговорки ролик не выпускается (release.mjs ❌). TODO: заполнить по политике правообладателя
// (BRIEF.md → «Право»)
export const legal: BrandLegal = {disclaimer: '', policyUrl: '', forbidden: [], forbiddenInVideo: [], forbiddenInTags: [], required: true};

// Финал роликов канала: прощание и текст диктора (TODO); сегмент финала собирает канал студии в формате своего стиля
export const OUTRO = {title: 'TODO прощание', vo: 'TODO текст диктора финала: подписка, ссылки'};

// Общие настройки всех роликов канала: музыка-подложка (TODO: треки из public с лицензией в public/lib/manifest.json), частота,
// субтитры, голос (TODO: voice_id диктора по пробам — BRIEF.md → «Голос и звук»), произношение — словари игры и студии
export const YT_BASE: {music: string[]; fps: 30 | 60; subtitles: 'auto' | 'on' | 'off'; voice: {id?: string; tempo: number}; pronounce: Record<string, string>} = {
  music: [],
  fps: 60,
  subtitles: 'auto',
  voice: {tempo: 1},
  pronounce: {},
};
`,
  );
}

// 5) новый стиль
if (newLook) {
  put(
    path.join(lookDir, 'README.md'),
    `# Стиль «${look}»

Заготовка — \`scripts/new-direction.mjs\` (${today}), студия \`src/studios/${dir}\`. Сейчас \`look.tsx\` — заглушка движка (ровный фон,
сцены без перехода, простые субтитры), чтобы студия собиралась; сцен стиля нет.

Стиль строится **только после стиль-кадров и «да» пользователя** (навык \`studio-new-direction\`, шаги 4–5): 2–3 статичных варианта →
выбор → \`video/taste/${key}.md\`. Тогда здесь: theme, \`look.tsx\` (\`VoicedLook\`: фон, переход \`Frame\`, субтитры, поверх, перекрытие,
звук стыка), \`parts/\`, \`scenes/\` (сцены без игры: компонент + \`defineScene\`), витрина приёмов (\`showcase/README.md\`).
Правила других стилей («Компендиум» — пергамент, сукно, сургуч) сюда не переносятся. Общий вкус — \`video/TASTE.md\`.

Импорты: стиль знает только \`src/core\` и себя — не игру и не бренд (их сцены получают через ctx канала; \`scripts/check-layers.mjs\`).
`,
  );
  put(
    path.join(lookDir, 'look.tsx'),
    `// Стиль «${look}» — ЗАГЛУШКА скаффолда (scripts/new-direction.mjs): ровный фон, сцены без перехода, простые субтитры.
// Настоящий стиль — только после стиль-кадров и «да» пользователя (навык studio-new-direction, шаги 4–5); см. ./README.md
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useFrame} from '../../core/time/fps';
import type {FrameProps, VoicedLook} from '../../core/video/registry';
import type {Sub} from '../../core/voice/timing';

const Backdrop: React.FC = () => <AbsoluteFill style={{background: '#ece6da'}} />;
const Frame: React.FC<FrameProps> = ({children}) => <AbsoluteFill>{children}</AbsoluteFill>;
const Subtitles: React.FC<{subs: Sub[]; cx: number; bottom: number; maxW: number}> = ({subs, cx, bottom, maxW}) => {
  const f = useFrame();
  const cue = subs.find((s) => f >= s.from && f < s.to);
  if (!cue) return null;
  return (
    <div style={{position: 'absolute', left: cx - maxW / 2, width: maxW, bottom, textAlign: 'center', whiteSpace: 'pre-line', fontFamily: 'sans-serif', fontSize: 32, lineHeight: 1.3, color: '#2b2621'}}>
      {cue.text}
    </div>
  );
};

export const ${lookExport}: VoicedLook = {
  Backdrop,
  Frame,
  Subtitles,
  subtitles: {cx: 960, maxW: 1560, bottom: 26},
  overlap: 0,
};
`,
  );
  put(
    path.join(lookDir, 'showcase', 'README.md'),
    `# Витрина приёмов «${look}»

Заглушка: приёмов стиля пока нет. Витрина — композиция в студии \`src/studios/${dir}\` (стиль по правилу слоёв не импортирует игру,
поэтому витрина с данными игры живёт в студии, а здесь только ссылка): каждый приём движения отдельно, с подписью — имя для кода,
длительность, кривая. Образец — \`src/looks/compendium/showcase/README.md\`.
`,
  );
}

// 7) навык и вкус — если их ещё нет
const skillFile = path.join(ROOT, '.claude', 'skills', dir, 'SKILL.md');
const tasteFile = path.join(VIDEO, 'taste', `${key}.md`);
const kept = [];
if (fs.existsSync(skillFile)) kept.push(skillFile);
else put(skillFile, template('direction-SKILL.md'));
if (fs.existsSync(tasteFile)) kept.push(tasteFile);
else put(tasteFile, template('taste.md'));
if (hasGame) kept.push(gameDir);
if (hasBrand) kept.push(brandFile);
if (!newLook) kept.push(lookDir);
const exists = [...files.keys()].filter((f) => fs.existsSync(f));
if (exists.length) fail(`уже существуют — скаффолд ничего не перезаписывает:\n  - ${exists.map((f) => path.relative(ROOT, f)).join('\n  - ')}`);

// 1) и 6) строки реестра и package.json — правкой текста, форма файлов не меняется
const entry = {key, dir, kind: 'youtube', title, game, brand, look, idPrefix: prefix, port, freeze: 'golden'};
const regText = fs.readFileSync(REGISTRY, 'utf8');
const regLine = `  {${Object.entries(entry).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`;
const regEnd = regText.lastIndexOf('}');
if (regEnd < 0 || !/^\s*\]\s*$/.test(regText.slice(regEnd + 1))) fail('src/studios/studios.json: не понял разметку (ждал список записей, по одной на строку)');
const eolReg = regText.includes('\r\n') ? '\r\n' : '\n';
const regNext = regText.slice(0, regEnd + 1) + ',' + eolReg + regLine + regText.slice(regEnd + 1);
const scriptLine = `"${scriptName}": "remotion studio src/studios/${dir}/index.ts --port ${port}"`;
const lastStudio = [...pkgText.matchAll(/^([ \t]*)"studio:[^"]+":\s*"[^"]*",?\r?$/gm)].at(-1);
if (!lastStudio) fail('package.json: не нашёл строк "studio:…" в scripts');
const lineEnd = lastStudio.index + lastStudio[0].replace(/\r$/, '').length;
const eolPkg = pkgText.includes('\r\n') ? '\r\n' : '\n';
const hadComma = lastStudio[0].replace(/\r$/, '').endsWith(',');
const pkgNext = pkgText.slice(0, lineEnd) + (hadComma ? '' : ',') + eolPkg + lastStudio[1] + scriptLine + (hadComma ? ',' : '') + pkgText.slice(lineEnd);
JSON.parse(regNext);
JSON.parse(pkgNext);

// ── План / запись ──
const show = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
console.log(`${dry ? 'План (--dry, ничего не пишется)' : 'Новое направление'}: ${key} → src/studios/${dir} (игра ${game}${hasGame ? '' : ', новая'}, бренд ${brand}${hasBrand ? '' : ', новый'}, стиль ${look}${newLook ? ', новый — заглушка' : ''}, id ${prefix}…, порт ${port})`);
console.log(`  дописать: video/src/studios/studios.json — строка «${key}»; video/package.json — "${scriptName}" (единственная правка package.json)`);
console.log(`  создать (${files.size}):\n${[...files.keys()].map((f) => `    ${show(f)}`).join('\n')}`);
if (kept.length) console.log(`  уже есть — не трогаю:\n${kept.map((f) => `    ${show(f)}`).join('\n')}`);
console.log(`  сцены канала: ${sceneLines.length ? sceneLines.join(', ') : 'нет (TODO — после стиль-кадров)'}${lookDropped.length ? ` · сцены стиля ${lookDropped.map((s) => s.kind).join(', ')} заменены сценами игры` : ''}`);
if (dry) process.exit(0);

// Для отката пробного запуска: верхние папки, которых до записи не было, и новые файлы в уже существующих папках
const newDirs = new Set();
for (const f of files.keys()) {
  let d = path.dirname(f);
  let top = null;
  while (!fs.existsSync(d)) {
    top = d;
    d = path.dirname(d);
  }
  if (top) newDirs.add(top);
}
const undoPaths = [...newDirs, ...[...files.keys()].filter((f) => ![...newDirs].some((d) => f.startsWith(d + path.sep)))];

const written = [];
try {
  for (const [f, text] of files) {
    fs.mkdirSync(path.dirname(f), {recursive: true});
    fs.writeFileSync(f, text, {flag: 'wx'}); // wx — не перезаписывать, даже если файл появился между проверкой и записью
    written.push(f);
  }
  fs.writeFileSync(REGISTRY, regNext);
  written.push(REGISTRY);
  fs.writeFileSync(pkgFile, pkgNext);
  written.push(pkgFile);
} catch (e) {
  // сбой посередине — убрать только своё: записанные файлы, затем ставшие пустыми новые папки (чужое в них не трогается),
  // реестр и package.json — вернуть прочитанный перед записью текст; повторный запуск после этого идёт с чистого листа
  const left = [];
  for (const f of written.filter((f) => f !== REGISTRY && f !== pkgFile)) {
    try {
      fs.rmSync(f);
    } catch {
      left.push(f);
    }
  }
  const prune = (d) => {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) return;
    for (const c of fs.readdirSync(d)) prune(path.join(d, c));
    if (!fs.readdirSync(d).length) fs.rmdirSync(d);
    else left.push(d);
  };
  for (const d of newDirs) {
    try {
      prune(d);
    } catch {
      left.push(d);
    }
  }
  // файлы все записаны — значит, сбой на реестре или package.json: вернуть оба (запись могла оборваться на полпути)
  for (const [f, text] of written.length >= files.size ? [[REGISTRY, regText], [pkgFile, pkgText]] : []) {
    try {
      if (fs.readFileSync(f, 'utf8') !== text) fs.writeFileSync(f, text);
    } catch {
      left.push(f);
    }
  }
  fail(`запись прервана (${e.message}) — записанное убрано, studios.json и package.json как были.${left.length ? `\nУбрать не удалось — проверить руками:\n  - ${left.map(show).join('\n  - ')}` : ''}`);
}

console.log(`
✓ заведено. В package.json добавлена строка "${scriptName}" — это правка конфигурации, скажи пользователю.

Дальше (чек-лист навыка studio-new-direction):
  1. Бриф — src/studios/${dir}/BRIEF.md: канал и название, аудитория, форматы, голос, музыка, ссылки, данные, право,
     монетизация; неизвестное — спросить пользователя ОДНИМ списком.
  2. Игровой набор — src/games/${game}/GAME.md, загрузчики scripts/games/${game}/, ids.ts (пишет загрузчик, не скаффолд), словарь data/pronounce.json${hasGame ? ' (игра уже есть — сверить)' : ''}.
  3. Юридический блок — legal в src/brands/${brand}/channel.ts (disclaimer, policyUrl, forbidden, forbiddenInVideo, forbiddenInTags, required), раздел «Право» в GAME.md.
  4. Стиль-кадры: 2–3 статичных варианта → выбор пользователя → video/taste/${key}.md, кадры — qa/taste/${key}/. Без этого сцены не строить.
  5. Стиль и сцены${newLook ? ` (src/looks/${look} — сейчас заглушка)` : ''}, сцены игры, channel.ts: context, scenes, qa, LIMITS; фрагмент 10–45 с и «да».
  6. Демо всех сцен ${prefix}template-demo, эталоны — yt-golden ${prefix}template-demo --approve только после «да».
  7. Навык направления — .claude/skills/${dir}/SKILL.md (заготовка) + examples.md.
  8. Проверка слабой моделью (Haiku) по навыку, без трат.
  9. Регистрация: строка в корневом CLAUDE.md и в src/studios/README.md.
Проверка сейчас: npx tsc --noEmit -p . · node scripts/check-layers.mjs --strict · node scripts/studios.mjs · npm run ${scriptName}

Откат (если направление заводилось на пробу) — удалить только это:
${undoPaths.map((f) => `  - ${show(f)}`).join('\n')}
  и одну строку «${key}» в src/studios/studios.json, одну строку "${scriptName}" в package.json.
  studios.json и package.json целиком не удалять и не возвращать из git: это общий реестр и конфиг, в них строки
  других студий и правки, которых нет в коммите. Проверка отката: node scripts/studios.mjs — прежний список студий.`);
