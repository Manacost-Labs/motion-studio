// Обработка голоса диктора («адаптер»): сухие записи сцен → обработанные файлы, которые идут в ролик.
//   node scripts/vo-fx.mjs <id> [--preset broadcast|warm|off] [--format wav|mp3] [сцена…]
// Берёт out/<id>/vo-raw/dry/<сцена>.wav или .mp3 (их пишут vo-align.mjs и tts.mjs; есть оба — более свежий; при первом
// запуске сюда переносятся уже лежащие в public записи), пишет public/vo/<id>/<сцена>.<формат>. Пресет по умолчанию —
// voice.fx в конфиге или broadcast. Формат: у сцены, уже записанной в mp3, остаётся mp3 (данные готового ролика не
// меняются); новый ролик — wav: голос сжимается с потерями один раз, в финальном рендере. Файл другого формата той же
// сцены удаляется — иначе движок (core/voice/calc.ts ищет mp3 → wav → m4a) взял бы старую запись.
// Цепочка не сдвигает звук во времени — тайминги слов (<сцена>.json) остаются верными.
// Громкость каждой сцены приводится к −18 LUFS двумя проходами (замер → точная линейная поправка), без «качания».
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VIDEO} from './lib/paths.mjs';
import {loadConfig, voiceFile} from './vo-lib.mjs';

export const PRESETS = {
  // вещательный голос: срез гула, меньше «бубнения», больше разборчивости, мягче шипящие, ровнее громкость
  broadcast: [
    'highpass=f=85',
    'equalizer=f=220:t=q:w=1.1:g=-2',
    'equalizer=f=3400:t=q:w=1.2:g=2.5',
    'deesser=i=0.45:m=0.5:f=0.55',
    'acompressor=threshold=-22dB:ratio=3:attack=6:release=90:makeup=2',
  ],
  // мягче и теплее: меньше подъёма верха, чуть больше низа, щадящая компрессия
  warm: ['highpass=f=70', 'equalizer=f=180:t=q:w=1:g=1', 'equalizer=f=3000:t=q:w=1.4:g=1.2', 'deesser=i=0.35:m=0.4:f=0.55', 'acompressor=threshold=-24dB:ratio=2:attack=10:release=150:makeup=1.5'],
  off: [],
};
const TARGET = 'I=-18:TP=-2:LRA=7';
const CODEC = {mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'], wav: ['-c:a', 'pcm_s16le']};
const AUDIO = /\.(mp3|wav)$/;

const loudnorm = (file, pre) => {
  const chain = [...pre, `loudnorm=${TARGET}:print_format=json`].join(',');
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', chain, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  return `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
};

// format — 'wav' | 'mp3' для всех сцен; по умолчанию у каждой сцены свой (см. шапку)
export const processVoice = (id, preset = 'broadcast', only = [], format) => {
  const chain = PRESETS[preset];
  if (!chain) throw new Error(`Нет пресета «${preset}»: ${Object.keys(PRESETS).join(', ')}`);
  if (format && !CODEC[format]) throw new Error(`Нет формата «${format}»: ${Object.keys(CODEC).join(', ')}`);
  const pub = path.join(VIDEO, 'public', 'vo', id);
  const dry = path.join(VIDEO, 'out', id, 'vo-raw', 'dry');
  fs.mkdirSync(dry, {recursive: true});
  fs.mkdirSync(pub, {recursive: true});
  const segOf = (f) => f.replace(AUDIO, '');
  // первый запуск: всё, что лежит в public и ещё не сохранено сухим, — и есть сухие записи
  for (const f of fs.readdirSync(pub).filter((x) => AUDIO.test(x))) {
    if (!voiceFile(dry, segOf(f))) fs.copyFileSync(path.join(pub, f), path.join(dry, f));
  }
  const published = fs.readdirSync(pub).filter((x) => AUDIO.test(x));
  const usual = published.length ? (published.filter((f) => f.endsWith('.mp3')).length * 2 >= published.length ? 'mp3' : 'wav') : 'wav';
  const segs = [...new Set(fs.readdirSync(dry).filter((f) => AUDIO.test(f)).map(segOf))].filter((s) => !only.length || only.includes(s));
  const made = {mp3: 0, wav: 0};
  for (const seg of segs) {
    const src = voiceFile(dry, seg);
    const fmt = format ?? voiceFile(pub, seg)?.match(AUDIO)[1] ?? usual;
    const out = path.join(pub, `${seg}.${fmt}`);
    const af = [...chain, loudnorm(src, chain)].join(',');
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', af, '-ar', '44100', ...CODEC[fmt], out]);
    if (r.status !== 0) throw new Error(`${seg}: ${r.stderr}`);
    for (const e of ['mp3', 'wav', 'm4a']) if (e !== fmt) fs.rmSync(path.join(pub, `${seg}.${e}`), {force: true});
    made[fmt]++;
  }
  console.log(`vo-fx: ${segs.length} сцен, пресет ${preset}${made.wav ? `, wav ${made.wav}` : ''}${made.mp3 ? `, mp3 ${made.mp3}` : ''} → public/vo/${id}/`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.chdir(VIDEO);
  const args = process.argv.slice(2);
  const id = args[0];
  if (!id) throw new Error('node scripts/vo-fx.mjs <id> [--preset broadcast|warm|off] [--format wav|mp3] [сцена…]');
  const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
  const config = await loadConfig(id);
  const preset = opt('preset') ?? config.voice?.fx ?? 'broadcast';
  processVoice(id, preset, args.slice(1).filter((a, k, all) => !a.startsWith('--') && !['--preset', '--format'].includes(all[k - 1])), opt('format'));
}
