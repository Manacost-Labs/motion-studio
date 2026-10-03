// Всё, что нужно к YouTube-ролику, кроме самого видео: node scripts/yt-export.mjs <id композиции>
// Пишет в out/<id>/:
//   script.md       — текст диктора по сегментам с именами файлов для записи (public/vo/<id>/<сегмент>.mp3)
//   description.txt — описание: таймкоды глав, коды колод, ссылки
//   subtitles.srt   — субтитры по тексту диктора (после записи голоса перезапустить — тайминг обновится)
import {bundle} from '@remotion/bundler';
import {selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {entryPoint} from './studios.mjs';

const id = process.argv[2];
if (!id) throw new Error('node scripts/yt-export.mjs <id композиции>');
const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const comp = await selectComposition({serveUrl, id, browserExecutable});
const {config, timing} = comp.props;
const fps = timing.base ?? comp.fps; // тайминги шаблона — в «кадрах-30», даже если ролик рендерится в 60 к/с
const outDir = path.resolve('out', id);
fs.mkdirSync(outDir, {recursive: true});

const clock = (frames) => {
  const s = Math.floor(frames / fps);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const srtTime = (frames) => {
  const ms = Math.round((frames / fps) * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const chapters = timing.segments.map((t) => t.chapter); // названия глав считает шаблон (scenes/index.tsx → chapterOf)
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

// Описание: главы + коды колод + ссылки
const decks = config.segments.filter((s) => s.kind === 'deck' && s.code);
const description = [
  config.title,
  '',
  config.url ? `Статья: ${config.url}` : null,
  '',
  'Таймкоды:',
  // сцена без главы (начало, разделитель) входит в следующую: глава начинается с её начала — первая с 0:00
  ...config.segments.flatMap((s, i) => {
    if (!label(s)) return [];
    let k = i;
    while (k > 0 && !label(config.segments[k - 1])) k--;
    return [`${clock(timing.segments[k].from)} ${label(s)}`];
  }),
  '',
  ...(decks.length ? [decks.length > 1 ? 'Коды колод:' : 'Код колоды:', ...decks.flatMap((d) => [`${d.rank !== undefined ? `${d.rank}. ` : ''}${d.name} (${d.cls})`, d.code, ''])] : []),
  'Манакост:',
  'Сайт — https://hs-manacost.ru',
  'Telegram — https://t.me/manacost_ru',
  'ВКонтакте — https://vk.com/manacost',
]
  .filter((l) => l !== null)
  .join('\n');
fs.writeFileSync(path.join(outDir, 'description.txt'), description);

// Субтитры
let n = 0;
const srt = timing.segments
  .flatMap((t) => t.subs.map((c) => `${++n}\n${srtTime(t.from + c.from)} --> ${srtTime(t.from + c.to)}\n${c.text}\n`))
  .join('\n');
fs.writeFileSync(path.join(outDir, 'subtitles.srt'), srt);

console.log(`${id}: ${clock(timing.total)} (${timing.total} кадров), голос записан в ${timing.segments.filter((t) => t.voice).length} из ${timing.segments.length} сегментов`);
for (const [i, s] of config.segments.entries()) {
  const t = timing.segments[i];
  console.log(`  ${clock(t.from).padStart(5)}  кадр ${String(t.from).padStart(5)}  +${String(t.dur).padStart(4)}  ${label(s)}`);
}
console.log(`→ out/${id}/script.md, description.txt, subtitles.srt`);
