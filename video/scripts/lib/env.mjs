// Ключи из video/.env — один разбор на все скрипты. Значения никогда не печатаются: в сообщениях только имя ключа.
// Формат строк: KEY=значение, KEY="значение" или KEY='значение'; # — комментарий; кавычки снимаются.
// Переменная, уже заданная в окружении, важнее файла (так можно подменить ключ на один запуск).
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './paths.mjs';

export const ENV_FILE = path.join(VIDEO, '.env');

// Известные ключи (образец — video/.env.example): зачем нужен и обязателен ли для своей команды
export const KEYS = {
  ELEVENLABS_API_KEY: 'озвучка и остаток кредитов ElevenLabs (tts.mjs, credits.mjs)',
  ELEVENLABS_VOICE_ID: 'голос диктора по умолчанию (tts.mjs)',
  ELEVENLABS_MODEL: 'модель ElevenLabs, по умолчанию eleven_v4',
  KOLODA_API_TOKEN: 'Koloda Hearthstone API — выше лимит запросов (meta-stats.mjs), не обязателен',
  TWITCH_CLIENT_ID: 'поиск клипов по категории Twitch (eyes.mjs find --twitch)',
  TWITCH_CLIENT_SECRET: 'поиск клипов по категории Twitch (eyes.mjs find --twitch)',
  TYPESAFE_API_KEY: 'смысловые проверки judge.mjs --backend jev (платно, текст уходит в США), не обязателен',
  ANTHROPIC_API_KEY: 'смысловые проверки judge.mjs --backend claude (платно), не обязателен',
  OPENROUTER_API_KEY: 'судьи judge.mjs --backend openrouter и --visual (Jev, Clef; платно, только после сметы) и остаток в credits.mjs',
  CHROME_PATH: 'браузер для рендера, если не стандартный путь Chrome (lib/remotion.mjs)',
};

export const parseEnv = (text) => {
  const out = {};
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) v = v.slice(1, v.indexOf(q, 1));
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
};

let loaded;
// Читает video/.env один раз и дописывает в process.env то, чего там ещё нет. Возвращает process.env
export const loadEnv = () => {
  if (!loaded) {
    loaded = fs.existsSync(ENV_FILE) ? parseEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};
    for (const [k, v] of Object.entries(loaded)) if (process.env[k] === undefined) process.env[k] = v;
  }
  return process.env;
};

// Есть ли непустой ключ (в окружении или в video/.env)
export const hasKey = (name) => !!loadEnv()[name]?.trim();
// Значение ключа или понятная ошибка «нет ключа X: зачем он» (без значения)
export const needKey = (name, why = KEYS[name]) => {
  if (!hasKey(name)) throw new Error(`Нет ${name} в video/.env${why ? ` — нужен для: ${why}` : ''} (образец — video/.env.example)`);
  return loadEnv()[name].trim();
};
