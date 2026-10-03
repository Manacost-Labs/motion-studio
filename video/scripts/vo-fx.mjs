// Обработка голоса диктора («адаптер»): сухие записи сцен → обработанные файлы, которые идут в ролик.
//   node scripts/vo-fx.mjs <id> [--preset broadcast|warm|off]
// Берёт out/<id>/vo-raw/dry/<сцена>.mp3 (их пишут vo-align.mjs и tts.mjs; при первом запуске сюда переносятся
// уже лежащие в public записи), пишет public/vo/<id>/<сцена>.mp3. Пресет по умолчанию — voice.fx в конфиге или broadcast.
// Цепочка не сдвигает звук во времени — тайминги слов (<сцена>.json) остаются верными.
// Громкость каждой сцены приводится к −18 LUFS двумя проходами (замер → точная линейная поправка), без «качания».
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadConfig} from './vo-lib.mjs';

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

const loudnorm = (file, pre) => {
  const chain = [...pre, `loudnorm=${TARGET}:print_format=json`].join(',');
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', chain, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  return `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
};

export const processVoice = (id, preset = 'broadcast', only = []) => {
  const chain = PRESETS[preset];
  if (!chain) throw new Error(`Нет пресета «${preset}»: ${Object.keys(PRESETS).join(', ')}`);
  const pub = path.resolve('public/vo', id);
  const dry = path.resolve('out', id, 'vo-raw', 'dry');
  fs.mkdirSync(dry, {recursive: true});
  // первый запуск: всё, что лежит в public и ещё не сохранено сухим, — и есть сухие записи
  for (const f of fs.existsSync(pub) ? fs.readdirSync(pub) : []) {
    if (f.endsWith('.mp3') && !fs.existsSync(path.join(dry, f))) fs.copyFileSync(path.join(pub, f), path.join(dry, f));
  }
  const files = fs.readdirSync(dry).filter((f) => f.endsWith('.mp3') && (!only.length || only.includes(f.replace(/\.mp3$/, ''))));
  for (const f of files) {
    const src = path.join(dry, f);
    const out = path.join(pub, f);
    const af = [...chain, loudnorm(src, chain)].join(',');
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', af, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', out]);
    if (r.status !== 0) throw new Error(`${f}: ${r.stderr}`);
  }
  console.log(`vo-fx: ${files.length} сцен, пресет ${preset} → public/vo/${id}/`);
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('vo-fx.mjs')) {
  const args = process.argv.slice(2);
  const id = args[0];
  if (!id) throw new Error('node scripts/vo-fx.mjs <id> [--preset broadcast|warm|off] [сцена…]');
  const i = args.indexOf('--preset');
  const config = await loadConfig(id);
  const preset = i >= 0 ? args[i + 1] : config.voice?.fx ?? 'broadcast';
  processVoice(id, preset, args.slice(1).filter((a, k, all) => !a.startsWith('--') && all[k - 1] !== '--preset'));
}
