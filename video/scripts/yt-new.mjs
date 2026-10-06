// Новый YouTube-ролик Манакоста по статье hs-manacost.ru — одной командой:
//   node scripts/yt-new.mjs <url статьи> yt-<тема> [--no-posters]
// 1) scripts/fetch-article.mjs → src/studios/manacost-youtube/yt-<тема>/article.json (колоды, коды, 30 карт, абзацы, карты в тексте)
// 2) scripts/deck-posters.mjs → постеры колод и точная раскладка карт (~1 мин на колоду; --no-posters — пропустить)
// 2б) scripts/meta-stats.mjs → meta.json: винрейт, доля в мете, матч-апы и муллиган по данным HSReplay (Koloda API)
// 3) config.ts — заготовка со всеми сценами: сильное начало, вступление, колоды с последнего места, разделители блоков,
//    финал с итоговой таблицей. Черновик текста диктора — абзацы статьи, карты под голос — карты, упомянутые в тексте.
//    Всё, что пишет автор, помечено TODO: пока TODO есть, node scripts/yt-qa.mjs <id> --no-video выдаёт ошибки
// 4) регистрация — строка в src/studios/manacost-youtube/videos.ts (Root.tsx регистрирует список → композиции yt-<тема> и yt-<тема>-thumb)
// Готовое не перезаписывает: повторный запуск докачивает недостающее. Дальше — навык manacost-youtube, «Быстрый старт».
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {VIDEO} from './lib/paths.mjs';
import {studio as studioRec, studioDir} from './lib/studios.mjs';
import {addVideo} from './lib/text.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const [url, id] = args.filter((a) => !a.startsWith('--'));
const prefix = studioRec('youtube').idPrefix; // студия Манакоста: статьи hs-manacost.ru, шаблон «Компендиум»
if (!url || !id || !new RegExp(`^${prefix}[a-z0-9-]+$`).test(id)) throw new Error(`node scripts/yt-new.mjs <url статьи> ${prefix}<тема латиницей через дефис> [--no-posters]`);
const studio = studioDir('youtube');
const dir = path.join(studio, id);
const articleFile = path.join(dir, 'article.json');
const run = (script, ...a) => {
  console.log(`\n→ node scripts/${script} ${a.join(' ')}`);
  const r = spawnSync('node', [path.join(VIDEO, 'scripts', script), ...a], {stdio: 'inherit', cwd: VIDEO});
  if (r.status) throw new Error(`${script} завершился с ошибкой`);
};

// 1–2. Данные статьи и постеры
if (!fs.existsSync(articleFile)) run('fetch-article.mjs', url, id);
let article = JSON.parse(fs.readFileSync(articleFile, 'utf8'));
if (!args.includes('--no-posters') && article.decks.some((d) => !d.poster)) {
  run('deck-posters.mjs', id);
  article = JSON.parse(fs.readFileSync(articleFile, 'utf8'));
}

// 2б. Статистика меты (не обязательна: если API недоступен — заготовка всё равно создаётся)
if (!fs.existsSync(path.join(dir, 'meta.json'))) {
  try {
    run('meta-stats.mjs', id);
  } catch (e) {
    console.log(`статистика не получена (${e.message}) — позже: node scripts/meta-stats.mjs ${id}`);
  }
}

// 3. Заготовка конфига
const decks = [...article.decks].sort((a, b) => b.rank - a.rank);
const N = decks.length;
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
// длинный текст — по абзацу на строку: 'абзац ' + 'абзац'
const qLines = (parts, pad) => parts.map((p, i) => pad + q(i < parts.length - 1 ? p + ' ' : p)).join(' +\n');
const ORD = ['', 'первое', 'второе', 'третье', 'четвёртое', 'пятое', 'шестое', 'седьмое', 'восьмое', 'девятое', 'десятое', 'одиннадцатое', 'двенадцатое', 'тринадцатое', 'четырнадцатое', 'пятнадцатое', 'шестнадцатое', 'семнадцатое', 'восемнадцатое', 'девятнадцатое', 'двадцатое'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const words = (s, n) => s.replace(/[«»"()]/g, '').split(/\s+/).slice(0, n).join(' ').replace(/[\s,.:;!?—-]+$/, '');
// карта колоды для обложки: первая упомянутая в тексте, иначе самая дорогая легендарка; taken — уже занятые (без повторов)
const firstCard = (d, taken = new Set()) => {
  const pick = [...d.paragraphs.flatMap((p) => p.cards.map((c) => c.id)), ...d.list.filter((c) => c.rarity === 'LEGENDARY').sort((a, b) => b.cost - a.cost).map((c) => c.id), ...d.list.map((c) => c.id)].find((id) => !taken.has(id));
  taken.add(pick);
  return pick;
};
const dividers = new Set([10, 5].filter((r) => r < N - 2));
const constName = id.toUpperCase().replace(/-/g, '_');

const deckBlock = (d) => {
  const lead = `${cap(ORD[d.rank] ?? `${d.rank}-е`)} место — ${d.rank <= 3 ? '[pause] ' : ''}${d.name}.`;
  const paras = [lead, ...d.paragraphs.map((p) => p.text)];
  const anchors = d.paragraphs.slice(0, 3).map((p) => words(p.text, 3));
  const seen = new Set();
  const cards = d.paragraphs.flatMap((p) => p.cards).filter((c) => !seen.has(c.id + c.name) && seen.add(c.id + c.name));
  return [
    `    deck(${d.rank}, {`,
    `      // ${d.name} (${d.cls}). Черновик vo — абзацы статьи: перескажите разговорно (короткие фразы, числа словами, без латиницы),`,
    `      // фразы из at оставьте дословно или поправьте at под новый текст (yt-qa покажет потерянные)`,
    `      vo:`,
    qLines(paras, '        ') + ',',
    `      // 2–3 тезиса: заголовок до 28 знаков, пояснение до 45; цифры — только из статьи`,
    `      points: [`,
    ...anchors.map((a) => `        {text: 'TODO тезис', detail: 'TODO пояснение', at: ${q(a)}},`),
    `      ],`,
    `      // матч-апы, если статья о них говорит: {cls: 'Воин', verdict: 'good' | 'bad', label: 'Дракон Воин', at: 'фраза из vo'}`,
    `      vs: [],`,
    `      // карты под голос (камера наезжает); ink: true — обвести пером то, что диктор называет главным (2–3 на колоду)`,
    `      cards: [`,
    ...cards.map((c) => `        {id: '${c.id}', at: ${q(c.name)}},`),
    `      ],`,
    `    }),`,
  ].join('\n');
};

const top = (r) => decks.find((d) => d.rank === r);
const config = `// YouTube: «${article.title}» (${article.url}).
// Заготовка — scripts/yt-new.mjs. Данные колод — article.json (fetch-article.mjs, deck-posters.mjs). Здесь — текст диктора (vo)
// и то, что показывается под голос: at — фраза из vo, на которой это появляется. Как заполнять — навык manacost-youtube.
// Готовность: node scripts/yt-qa.mjs ${id} --no-video — 0 ошибок (пока есть TODO, ошибки будут).
import {articleClasses, articleDeck, articleTease, DeckText, divider, manacostOutro, YT_BASE, YtConfig} from '../channel';
import article from './article.json';

// колода №rank: данные статьи (название, класс, код, 30 карт, постер) + текст ниже
const deck = (rank: number, text: DeckText) => articleDeck(article, rank, text);

export const ${constName}: YtConfig = {
  ...YT_BASE, // музыка-подложка, 60 к/с, голос Alex Bell (+6 % темпа), без субтитров в кадре — brands/manacost/channel.ts
  id: '${id}',
  title: 'TODO название на YouTube до 70 знаков | Hearthstone',
  url: article.url,
  // как читать диктору сокращения и имена (на экране остаётся написание из текста); yt-qa подскажет, каких не хватает
  pronounce: {...YT_BASE.pronounce},
  thumb: {
    title: 'TODO\\nдве строки по 14 знаков',
    badge: 'TODO Месяц год',
    cards: [${((taken) => [2, 3, 1].filter(top).map((r) => `'${firstCard(top(r), taken)}'`))(new Set()).join(', ')}], // карты веером: №2, №3, №1 (в центре), без повторов
    hook: '№1?',
  },
  segments: [
    // Сильное начало, 4–6 с: самый яркий факт статьи одной фразой (урон, рекорд, неожиданное место). Числа — из статьи.
    // value — число на экране, at — фраза, на которой оно отсчитывается; cards — 2–3 карты веером; punch — добивка внизу
    {
      kind: 'hook',
      id: 'hook',
      value: 0,
      label: 'TODO подпись к числу',
      at: 'TODO',
      cards: [],
      punch: {text: 'TODO добивка', at: 'TODO', cls: '${decks[0].cls}'},
      vo: 'TODO факт. [pause] [curious] TODO добивка.',
    },
    {
      kind: 'intro',
      id: 'intro',
      kicker: 'TODO Дополнение · месяц год',
      title: 'TODO заголовок\\nв две строки',
      sub: 'Стандарт · с ${N}-го места до 1-го',
      classes: articleClasses(article),
      tease: articleTease(article), // постеры топ-3 под размытием: №1 не называем до конца
      // интригу держать: кто первый — не говорить. [warmly] — тёплая подача, [curious] — интрига; [excited] не ставить
      vo:
${qLines(['[warmly] ' + (article.intro ?? []).map((p) => p.text).join(' '), '[curious] TODO кто же на первом месте? Узнаем в самом конце.'], '        ')},
    },
${decks.map((d) => (dividers.has(d.rank) ? `    divider(${d.rank}, ${Math.max(1, d.rank - 4)}),\n` : '') + deckBlock(d)).join('\n')}
    manacostOutro({kicker: 'Итоги · TODO дополнение · месяц год', title: 'Все ${N} колод'}),
  ],
};
`;
const configFile = path.join(dir, 'config.ts');
if (fs.existsSync(configFile)) console.log(`\nconfig.ts уже есть — не трогаю: ${path.relative(process.cwd(), configFile)}`);
else {
  fs.writeFileSync(configFile, config);
  console.log(`\nзаготовка: ${path.relative(process.cwd(), configFile)} (${N} колод, разделители перед ${[...dividers].join(', ') || '—'})`);
}

// 4. Регистрация: импорт конфига и строка в списке VIDEOS (src/studios/manacost-youtube/videos.ts); Root.tsx регистрирует список сам
const videosFile = path.join(studio, 'videos.ts');
let videos = fs.readFileSync(videosFile, 'utf8');
if (!videos.includes(`'./${id}/config'`)) {
  // концы строк файла (LF или CRLF) сохраняются — scripts/lib/text.mjs → addVideo
  const next = addVideo(videos, {constName, id, note: `«${article.title}» по статье hs-manacost.ru — черновик`});
  // разметка videos.ts не та — не портить файл вставкой «куда-нибудь»
  if (!next) throw new Error(`videos.ts: не нашёл импорты или список VIDEOS — добавь вручную import {${constName}} from './${id}/config' и строку ${constName}, в VIDEOS`);
  videos = next;
  fs.writeFileSync(videosFile, videos);
  console.log(`зарегистрирован в videos.ts: ${id}, ${id}-thumb`);
}

console.log(`
Дальше (навык manacost-youtube, «Быстрый старт»):
  1. Заполнить TODO в ${path.relative(process.cwd(), configFile)}: hook, intro, тезисы колод; переписать vo разговорно.
  2. node scripts/yt-qa.mjs ${id} --no-video        — до 0 ошибок
  3. node scripts/yt-board.mjs ${id}                 — раскадровка, смотреть out/${id}/board/sheet-*.jpg
  4. Голос: node scripts/vo-align.mjs ${id} --prepare  → генерация кусков → node scripts/vo-align.mjs ${id}`);
