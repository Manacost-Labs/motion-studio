// Озвучка YouTube-роликов через ElevenLabs (модель из .env, по умолчанию eleven_v4). Ключ — только в video/.env.
//   node scripts/tts.mjs <id ролика>                          — смета: знаки, примерная цена, остаток на счёте. Ничего не тратит
//   node scripts/tts.mjs <id ролика> --go [сегмент…]           — записать изменившиеся сегменты (или только названные)
//   node scripts/tts.mjs <id ролика> --go --force [сегмент…]    — перезаписать, даже если текст не менялся
//   node scripts/tts.mjs <id ролика> --samples intro,deck-01 --voices <id>,<id>   — пробы голосов в out/<id>/voice-samples/
// Пишет public/vo/<id>/<сегмент>.mp3 и <сегмент>.json. В json — время начала и конца каждого символа текста, который
// на экране (без аудиотегов и до замен из pronounce): шаблон ставит по нему субтитры, карты и тезисы точно на слово.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadConfig, speakable} from './vo-lib.mjs';

const API = 'https://api.elevenlabs.io/v1';
const PRICE = {eleven_v4: 0.022, eleven_v4_turbo: 0.011, eleven_v3: 0.08, eleven_multilingual_v2: 0.08}; // $ за 1000 знаков, прайс на 29.09.2026 (v4 — со скидкой до 12.10)

const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/tts.mjs <id ролика> [--go] [--force] [сегмент…] | --samples <сегменты> --voices <id,…>');
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !['--samples', '--voices'].includes(all[i - 1]));

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v4';

const call = async (url, init = {}, tries = 4) => {
  for (let t = 1; ; t++) {
    const r = await fetch(url, {...init, headers: {'xi-api-key': KEY, 'content-type': 'application/json', ...init.headers}});
    if (r.ok) return r.json();
    const body = await r.text();
    if ((r.status === 429 || r.status >= 500) && t < tries) {
      await new Promise((ok) => setTimeout(ok, 2000 * t));
      continue;
    }
    throw new Error(`ElevenLabs ${r.status}: ${body.slice(0, 400)}`);
  }
};

const settingsOf = (config) => {
  const v = config.voice ?? {};
  return {
    voice: v.id || process.env.ELEVENLABS_VOICE_ID,
    seed: v.seed ?? 1234,
    voice_settings: {stability: v.stability ?? 0.5, similarity_boost: v.similarity ?? 0.75, style: v.style ?? 0, speed: v.speed ?? 1, use_speaker_boost: true},
  };
};

// Один запрос with-timestamps; соседние сегменты передаются как контекст, чтобы интонация не обрывалась на стыках
const speak = async ({spoken, voice, seed, voice_settings, previous_text, next_text}) => {
  const body = {text: spoken, model_id: MODEL, language_code: 'ru', voice_settings, seed, previous_text, next_text};
  const r = await call(`${API}/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {method: 'POST', body: JSON.stringify(body)});
  return {audio: Buffer.from(r.audio_base64, 'base64'), alignment: r.alignment};
};

// Время каждого показываемого символа по посимвольным меткам произнесённого текста
const shownTimes = ({spoken, map}, alignment) => {
  const n = alignment.characters.length;
  const exact = alignment.characters.join('') === spoken;
  if (!exact) console.warn('   ! метки не совпали с текстом посимвольно — время разнесено пропорционально');
  const at = (k) => (exact ? k : Math.min(n - 1, Math.round((k / spoken.length) * n)));
  const start = map.map(([a]) => alignment.character_start_times_seconds[at(a)]);
  const end = map.map(([, b]) => alignment.character_end_times_seconds[at(b - 1)]);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {start: start.map(r3), end: end.map(r3)};
};

const config = await loadConfig(id);
const segs = config.segments.map((s) => ({id: s.id, ...speakable(s.vo, config.pronounce)}));
const st = settingsOf(config);
const price = PRICE[MODEL];
const cost = (chars) => (price ? `≈ $${((chars / 1000) * price).toFixed(2)}` : 'цена модели неизвестна');

// ── Пробы голосов: несколько сегментов разными голосами в out/<id>/voice-samples ──
if (option('samples')) {
  const pick = option('samples').split(',');
  const voices = (option('voices') ?? '').split(',').filter(Boolean);
  if (!KEY) throw new Error('Нет ELEVENLABS_API_KEY в video/.env');
  if (!voices.length) throw new Error('--voices <voice_id,…>');
  const dir = path.resolve('out', id, 'voice-samples');
  fs.mkdirSync(dir, {recursive: true});
  for (const v of voices) {
    const info = await call(`${API}/voices/${v}`).catch(() => ({name: v}));
    const name = String(info.name ?? v).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    for (const sid of pick) {
      const s = segs.find((x) => x.id === sid);
      if (!s) throw new Error(`Нет сегмента ${sid}`);
      const {audio} = await speak({...st, voice: v, spoken: s.spoken});
      const file = path.join(dir, `${name}__${sid}.mp3`);
      fs.writeFileSync(file, audio);
      console.log(`${path.relative(process.cwd(), file)} — ${s.spoken.length} зн.`);
    }
  }
  process.exit(0);
}

// ── Смета и запись ──
const dir = path.resolve('public/vo', id);
const hashOf = (s) => crypto.createHash('sha1').update(JSON.stringify({t: s.spoken, m: MODEL, v: st.voice, s: st.voice_settings, seed: st.seed})).digest('hex').slice(0, 16);
const todo = segs.filter((s) => {
  if (only.length && !only.includes(s.id)) return false;
  if (flag('force')) return true;
  const meta = path.join(dir, `${s.id}.json`);
  return !(fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).hash === hashOf(s) && fs.existsSync(path.join(dir, `${s.id}.mp3`)));
});
const chars = todo.reduce((n, s) => n + s.spoken.length, 0);
console.log(`${config.id}: модель ${MODEL}, голос ${st.voice || '— не задан —'}`);
for (const s of segs) console.log(`  ${todo.includes(s) ? '●' : '○'} ${s.id.padEnd(10)} ${String(s.spoken.length).padStart(5)} зн.`);
console.log(`К записи: ${todo.length} сегм., ${chars} зн., ${cost(chars)}  (○ — уже записан и не менялся)`);
if (KEY) {
  const sub = await call(`${API}/user/subscription`).catch(() => null);
  if (sub) console.log(`Тариф ${sub.tier}: использовано ${sub.character_count} из ${sub.character_limit} кредитов`);
}
if (!flag('go')) {
  console.log('Смета. Чтобы записать: --go');
  process.exit(0);
}
if (!KEY) throw new Error('Нет ELEVENLABS_API_KEY в video/.env');
if (!st.voice) throw new Error('Не выбран голос: voice.id в конфиге или ELEVENLABS_VOICE_ID в video/.env');
fs.mkdirSync(dir, {recursive: true});
for (const s of todo) {
  const i = segs.indexOf(s);
  const prev = segs[i - 1]?.spoken.slice(-300);
  const next = segs[i + 1]?.spoken.slice(0, 300);
  const {audio, alignment} = await speak({...st, spoken: s.spoken, previous_text: prev, next_text: next});
  fs.writeFileSync(path.join(dir, `${s.id}.mp3`), audio);
  const times = shownTimes(s, alignment);
  const meta = {hash: hashOf(s), model: MODEL, voice: st.voice, seed: st.seed, settings: st.voice_settings, text: s.shown, spoken: s.spoken, ...times};
  fs.writeFileSync(path.join(dir, `${s.id}.json`), JSON.stringify(meta));
  console.log(`  ✓ ${s.id}: ${times.end.at(-1)?.toFixed(1)} с`);
}
console.log(`Готово → public/vo/${id}/. Дальше: node scripts/yt-export.mjs ${id} и рендер.`);
