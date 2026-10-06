// Всё, что нужно к YouTube-ролику, кроме самого видео: node scripts/yt-export.mjs <id композиции>
// Пишет в out/<id>/:
//   script.md       — текст диктора по сегментам с именами файлов для записи (public/vo/<id>/<сегмент>.mp3)
//   description.txt — описание: лид (config.seo.lead; без него — название), таймкоды глав, коды колод, использованные
//                     материалы (автор, ссылка и лицензия каждого клипа — из паспортов public/clips/*.json), ссылки, хэштеги,
//                     в конце — оговорка правообладателя (legal.disclaimer бренда, если задана)
//   subtitles.srt   — субтитры по тексту диктора (после записи голоса перезапустить — тайминг обновится)
//   tags.txt, titles.txt (название и варианты для теста), pinned-comment.txt — если заданы в config.seo
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';
import {openComposition, quietFonts} from './lib/remotion.mjs';
import {loadBrand, loadChannel} from './lib/channel.mjs';
import {srtTime} from './lib/text.mjs';

process.chdir(VIDEO);
quietFonts();
const id = process.argv[2];
if (!id) throw new Error('node scripts/yt-export.mjs <id композиции>');
const {key, composition: comp} = await openComposition(id, {fallback: 'youtube'});
const {config, timing} = /** @type {{config: any, timing: any}} */ (comp.props);
const fps = timing.base ?? comp.fps; // тайминги шаблона — в «кадрах-30», даже если ролик рендерится в 60 к/с
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});
// главы — тот же расчёт, что проверяет yt-qa (core/qa/audit.ts → chapterList; канал — scripts/lib/channel.mjs)
const {chapterList} = (await loadChannel(key, 'yt-export')).qa;
// подвал описания (имя канала и ссылки) и оговорка правообладателя (legal.disclaimer) — из бренда студии:
// src/brands/<brand>/channel.ts (brand — в studios.json; scripts/lib/channel.mjs → loadBrand)
const {descriptionFooter, legal} = await loadBrand(key, 'yt-export');

const clock = (frames) => {
  const s = Math.floor(frames / fps);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const chapters = timing.segments.map((t) => t.chapter); // названия глав считает движок по реестру сцен (core/voice/calc.ts → chapterOf, SceneDef.chapter)
const label = (s) => chapters[config.segments.indexOf(s)];

// Сценарий для диктора
const script = [
  `# ${config.title}`,
  '',
  `Темп — спокойный, около 900 знаков в минуту. Каждый сегмент — отдельный файл: \`public/vo/${config.id}/<сегмент>.mp3\` (подойдут .wav и .m4a).`,
  'Без пауз в начале и в конце файла. После записи перезапустить `node scripts/yt-export.mjs` — таймкоды и субтитры пересчитаются.',
  '',
  ...config.segments.flatMap((s, i) => {
    const t = timing.segments[i];
    if (!s.vo.trim()) return []; // разделитель блоков — без голоса
    return [`## ${s.id}${label(s) ? ` — ${label(s)}` : ''}`, '', `Файл: \`${s.id}.mp3\` · ${t.voice ? `записан, ${(t.voDur / fps).toFixed(1)} с` : `≈ ${(t.voDur / fps).toFixed(0)} с`}`, '', s.vo, ''];
  }),
].join('\n');
fs.writeFileSync(path.join(outDir, 'script.md'), script);

// Использованные материалы: чужие клипы по паспортам (CC BY требует автора, ссылку и лицензию); своя запись — не нужна
const licenseText = (l = '') => (/creative commons|^cc by/i.test(l) ? 'лицензия CC BY (Creative Commons Attribution)' : /согласию/i.test(l) ? 'с согласия автора' : l);
const materials = [
  ...new Map(
    config.segments
      .flatMap((s) => (s.kind === 'deck' ? s.inserts ?? [] : []))
      .filter((ins) => ins.kind === 'clip')
      .map((ins) => {
        const f = path.resolve('public', ins.src.replace(/\.[^.]+$/, '.json'));
        return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
      })
      .filter((p) => p && p.license !== 'своя запись')
      .map((p) => [p.source, `Геймплей: ${p.author} — «${p.title}», ${p.source} — ${licenseText(p.license)}`]),
  ).values(),
];

// Описание: лид + главы + коды колод + материалы + ссылки + хэштеги
const seo = config.seo;
const decks = config.segments.filter((s) => s.kind === 'deck' && s.code);
const hashtags = (seo?.hashtags ?? []).map((h) => `#${h.replace(/^#/, '')}`);
const description = [
  seo?.lead?.trim() || config.title,
  '',
  config.url ? `Статья: ${config.url}` : null,
  '',
  'Таймкоды:',
  // сцена без главы (начало, разделитель) входит в следующую: глава начинается с её начала — первая с 0:00
  ...chapterList(config, timing).map((c) => `${clock(c.from)} ${c.title}`),
  '',
  ...(decks.length ? [decks.length > 1 ? 'Коды колод:' : 'Код колоды:', ...decks.flatMap((d) => [`${d.rank !== undefined ? `${d.rank}. ` : ''}${d.name} (${d.cls})`, d.code, ''])] : []),
  ...(materials.length ? ['Использованные материалы:', ...materials, ''] : []),
  ...descriptionFooter,
  ...(hashtags.length ? ['', hashtags.join(' ')] : []),
  // оговорка правообладателя — последней строкой (если задана в бренде)
  ...(legal.disclaimer.trim() ? ['', legal.disclaimer.trim()] : []),
]
  .filter((l) => l !== null)
  .join('\n');
fs.writeFileSync(path.join(outDir, 'description.txt'), description);

// Теги, варианты названия, закреплённый комментарий — для вставки в YouTube Studio
const extra = [];
if (seo?.tags?.length) fs.writeFileSync(path.join(outDir, 'tags.txt'), seo.tags.join(', ') + '\n'), extra.push('tags.txt');
if (seo?.titles?.length) fs.writeFileSync(path.join(outDir, 'titles.txt'), [config.title, ...seo.titles].join('\n') + '\n'), extra.push('titles.txt');
if (seo?.pinnedComment) fs.writeFileSync(path.join(outDir, 'pinned-comment.txt'), seo.pinnedComment + '\n'), extra.push('pinned-comment.txt');

// Субтитры
let n = 0;
const srt = timing.segments
  .flatMap((t) => t.subs.map((c) => `${++n}\n${srtTime((t.from + c.from) / fps)} --> ${srtTime((t.from + c.to) / fps)}\n${c.text}\n`))
  .join('\n');
fs.writeFileSync(path.join(outDir, 'subtitles.srt'), srt);

console.log(`${id}: ${clock(timing.total)} (${timing.total} кадров), голос записан в ${timing.segments.filter((t) => t.voice).length} из ${timing.segments.length} сегментов`);
for (const [i, s] of config.segments.entries()) {
  const t = timing.segments[i];
  console.log(`  ${clock(t.from).padStart(5)}  кадр ${String(t.from).padStart(5)}  +${String(t.dur).padStart(4)}  ${label(s)}`);
}
if (seo?.playlist) console.log(`плейлист: ${seo.playlist}`);
console.log(`→ out/${id}/script.md, description.txt, subtitles.srt${extra.length ? `, ${extra.join(', ')}` : ''}`);
process.exit(process.exitCode ?? 0);
