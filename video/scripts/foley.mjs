// Шумовая отделка YouTube-шаблона: короткие звуки из библиотеки и синтез, без генерации (кредиты не нужны).
//   node scripts/foley.mjs
// Пишет public/lib/sfx/<имя>.wav (пик −1,5 dBFS, как у остальной библиотеки) и строки в public/lib/manifest.json.
//   cam-swish     — воздушный шорох наезда камеры на карту: sfx-whoosh быстрее и без верхов (без «волшебного» звона)
//   quill-scratch — росчерк пера по пергаменту под тезисом: шум 2–9 кГц с зернистой неровностью, ~0,7 с
//   coin-trickle  — монеты под счётчик пыли: начало coin-pile, 1,4 с с затуханием
//   seal-stamp    — глухой стук сургучной печати: drum-hit без верхов, короткий
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';

process.chdir(VIDEO);
const PUB = path.join(VIDEO, 'public');
const OUT = path.join(PUB, 'lib/sfx');
const MANIFEST = path.join(PUB, 'lib/manifest.json');
const PEAK = -1.5;

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], {encoding: 'utf8'});
  if (r.status) throw new Error(r.stderr);
};
const maxVolume = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
  return Number(r.stderr.match(/max_volume: (-?[\d.]+) dB/)[1]);
};
// собрать во временный файл, затем выровнять пик
const build = (name, args) => {
  const tmp = path.join(OUT, `${name}.tmp.wav`);
  const out = path.join(OUT, `${name}.wav`);
  ff([...args, '-ar', '48000', tmp]);
  ff(['-i', tmp, '-af', `volume=${(PEAK - maxVolume(tmp)).toFixed(2)}dB`, out]);
  fs.rmSync(tmp);
  return path.relative(PUB, out).replace(/\\/g, '/');
};

const made = {
  'sfx/cam-swish.wav': {
    from: 'audio/sfx-whoosh.wav',
    file: build('cam-swish', ['-i', path.join(PUB, 'audio/sfx-whoosh.wav'), '-af', 'atempo=1.7,highpass=f=140,lowpass=f=4200,afade=t=in:d=0.03,areverse,afade=t=in:d=0.25,areverse']),
  },
  'sfx/quill-scratch.wav': {
    from: 'синтез',
    file: build('quill-scratch', [
      '-filter_complex',
      'anoisesrc=d=0.75:c=white:r=48000:a=0.9:s=11[n];' +
        'anoisesrc=d=0.75:c=white:r=48000:a=1:s=5,lowpass=f=70,lowpass=f=70,volume=6[m];' +
        "[n][m]amerge=inputs=2,aeval='val(0)*min(1,0.45+abs(val(1)))':c=mono," +
        'highpass=f=2000,lowpass=f=9000,equalizer=f=4500:t=q:w=1:g=5,afade=t=in:d=0.02,afade=t=out:st=0.45:d=0.3',
    ]),
  },
  'sfx/seal-stamp.wav': {
    from: 'lib/sfx/drum-hit.wav',
    file: build('seal-stamp', ['-i', path.join(OUT, 'drum-hit.wav'), '-t', '0.7', '-af', 'highpass=f=45,lowpass=f=650,afade=t=out:st=0.3:d=0.4']),
  },
  'sfx/coin-trickle.wav': {
    from: 'lib/sfx/coin-pile.wav',
    file: build('coin-trickle', ['-i', path.join(OUT, 'coin-pile.wav'), '-t', '1.4', '-af', 'lowpass=f=9000,afade=t=out:st=1.0:d=0.4']),
  },
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
for (const [key, {from}] of Object.entries(made)) manifest[key] = {category: 'sfx', model: 'ffmpeg', from, recipe: 'scripts/foley.mjs'};
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1)); // формат файла: отступ в 1 пробел, без перевода строки в конце
for (const {file} of Object.values(made)) console.log(file);
