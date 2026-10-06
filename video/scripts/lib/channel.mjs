// Канал студии в Node (yt-qa, yt-export, release): esbuild собирает src/studios/<папка>/channel.ts вместе с проверками
// core/qa/audit.ts в node_modules/.cache/<name>-<студия>.cjs. Возвращает всё, что экспортирует channel.ts (channel, LIMITS,
// типовые помощники), и qa = qaOf(channel): {audit, assetsOf, expectedJumps, paceOf, chapterList, thumbVariants}.
//   const {LIMITS, qa} = await loadChannel(key, 'yt-qa');
import path from 'node:path';
import {createRequire} from 'node:module';
import {VIDEO} from './paths.mjs';
import {studio, studioDir} from './studios.mjs';

const posix = (p) => p.replace(/\\/g, '/');

export const loadChannel = async (key, name = 'channel') => {
  const {build} = await import('esbuild');
  const outfile = path.join(VIDEO, 'node_modules', '.cache', `${name}-${key}.cjs`);
  const channelTs = posix(path.join(studioDir(key), 'channel.ts'));
  const auditTs = posix(path.join(VIDEO, 'src', 'core', 'qa', 'audit.ts'));
  await build({
    stdin: {contents: `export * from '${channelTs}';\nexport {qaOf} from '${auditTs}';\n`, resolveDir: VIDEO, sourcefile: 'channel-entry.ts', loader: 'ts'},
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'error',
  });
  const mod = createRequire(import.meta.url)(outfile);
  return {...mod, qa: mod.qaOf(mod.channel)};
};

// Бренд студии в Node (yt-export, yt-qa, release): src/brands/<brand>/channel.ts (brand — в studios.json) → всё, что он
// экспортирует (BRAND, LINKS, descriptionFooter, legal …). legal без полей — пустой BrandLegal (core/video/types.ts): оговорки нет.
// Оговорка-заглушка с TODO считается незаданной: yt-export её не дописывает, release при legal.required даёт ❌
//   const {descriptionFooter, legal} = await loadBrand(key, 'yt-export');
export const loadBrand = async (key, name = 'brand') => {
  const {build} = await import('esbuild');
  const outfile = path.join(VIDEO, 'node_modules', '.cache', `${name}-brand-${key}.cjs`);
  await build({entryPoints: [path.join(VIDEO, 'src', 'brands', studio(key).brand, 'channel.ts')], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'error'});
  const mod = createRequire(import.meta.url)(outfile);
  const legal = {disclaimer: '', policyUrl: '', forbidden: [], forbiddenInVideo: [], forbiddenInTags: [], required: false, ...mod.legal};
  if (/\bTODO\b/.test(legal.disclaimer)) legal.disclaimer = '';
  return {...mod, legal};
};

// Где у канала стоит его название (проверка legal.forbidden в yt-qa): имя и сайт (BRAND), ссылки финала и подвала (LINKS: url,
// text, outro, label), подвал описания (descriptionFooter) — пары [где, текст]. Названия и теги роликов сюда не входят.
// У Манакоста BRAND нет (MANACOST) — его имя попадает сюда из подвала и ссылок
//   channelTexts(await loadBrand('youtube')) → [['ссылка канала', 'https://hs-manacost.ru'], …, ['подвал описания', 'Манакост:'], …]
export const channelTexts = (mod) =>
  [
    ['имя канала', mod.BRAND?.name],
    ['сайт канала', mod.BRAND?.site],
    ...(mod.LINKS ?? []).flatMap((l) => [['ссылка канала', l.url], ['надпись ссылки в финале', l.text], ['подпись ссылки в финале', l.outro], ['строка подвала', l.label]]),
    ...(mod.descriptionFooter ?? []).map((x) => ['подвал описания', x]),
  ].filter(([, text]) => typeof text === 'string' && text.trim());

// Запрещённые бренду слова и знаки (legal.forbidden, legal.forbiddenInVideo, legal.forbiddenInTags) в тексте: без учёта регистра, слово — целиком
// (не часть другого слова), знак (™, ®) — где угодно. forbiddenIn('Гайд на Ари | LoL', ['LoL', 'Riot']) → ['LoL']
export const forbiddenIn = (text, forbidden = []) =>
  forbidden.filter((w) => {
    const s = String(w ?? '').trim();
    if (!s) return false;
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /[\p{L}\p{N}]/u.test(s) ? new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu').test(String(text)) : String(text).includes(s);
  });
