// Находит темп и сетку долей трека, чтобы ставить стыки сцен в музыку.
//   node scripts/beats.mjs public/audio/music-v2.m4a
// Печатает BPM, длину доли в кадрах (30 fps), первую долю и сильные доли тактов.
import {execFileSync} from 'node:child_process';

const file = process.argv[2];
const SR = 11025;
const HOP = 256;
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 28});
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);

// Огибающая энергии и её положительный прирост — «атаки» звука
const n = Math.floor(x.length / HOP);
const env = new Float32Array(n);
for (let i = 0; i < n; i++) {
  let s = 0;
  for (let j = 0; j < HOP; j++) s += x[i * HOP + j] ** 2;
  env[i] = Math.log(1e-6 + s);
}
const onset = new Float32Array(n);
for (let i = 1; i < n; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);

// Темп: автокорреляция атак в диапазоне 70–180 BPM
const hopSec = HOP / SR;
let best = {bpm: 0, score: -1, lag: 0};
for (let bpm = 70; bpm <= 180; bpm += 0.25) {
  const lag = 60 / bpm / hopSec;
  let s = 0;
  for (let i = 0; i + lag * 4 < n; i++) {
    const a = onset[i];
    s += a * (lerp(onset, i + lag) + 0.5 * lerp(onset, i + lag * 2) + 0.25 * lerp(onset, i + lag * 4));
  }
  if (s > best.score) best = {bpm, score: s, lag};
}
function lerp(arr, t) {
  const i = Math.floor(t);
  const f = t - i;
  return (arr[i] ?? 0) * (1 - f) + (arr[i + 1] ?? 0) * f;
}

// Фаза: сдвиг сетки, при котором на доли приходится больше всего атак
const period = best.lag;
let phase = {off: 0, score: -1};
for (let off = 0; off < period; off += 0.25) {
  let s = 0;
  for (let t = off; t < n; t += period) s += Math.max(lerp(onset, t - 1), lerp(onset, t), lerp(onset, t + 1));
  if (s > phase.score) phase = {off, score: s};
}
const beatSec = period * hopSec;
const firstSec = phase.off * hopSec;

// Сильная доля такта (из 4): та, на которую в среднем приходятся самые сильные атаки
const acc = [0, 0, 0, 0];
let k = 0;
for (let t = phase.off; t < n; t += period, k++) acc[k % 4] += Math.max(lerp(onset, t - 1), lerp(onset, t), lerp(onset, t + 1));
const down = acc.indexOf(Math.max(...acc));

const fps = 30;
const beats = [];
for (let t = firstSec, i = 0; t < x.length / SR; t += beatSec, i++) beats.push({i, sec: +t.toFixed(3), frame: Math.round(t * fps), down: i % 4 === down});
console.log(JSON.stringify({bpm: best.bpm, beatSec: +beatSec.toFixed(4), beatFrames: +(beatSec * fps).toFixed(3), firstSec: +firstSec.toFixed(3), downbeatIndex: down}));
console.log('Сильные доли (кадр @30fps):', beats.filter((b) => b.down).map((b) => b.frame).join(' '));
