// Общее для озвучки YouTube-роликов (tts.mjs, vo-align.mjs): загрузка конфига ролика и подготовка текста диктора
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {studioDir} from './studios.mjs';

// Конфиг ролика — TypeScript: собираем esbuild-ом в кэш и берём экспорт с нужным id
export const loadConfig = async (id) => {
  const out = path.resolve('node_modules/.cache', `vo-${id}.cjs`);
  await build({entryPoints: [path.join(studioDir('youtube'), id, 'config.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error'});
  const req = createRequire(import.meta.url);
  delete req.cache[out];
  const config = Object.values(req(out)).find((v) => v && typeof v === 'object' && v.id === id);
  if (!config) throw new Error(`В src/studios/manacost-youtube/${id}/config.ts нет конфига с id «${id}»`);
  return config;
};

// Текст диктора → что говорим (с аудиотегами и заменами произношения) и что показываем (как написано).
// map[i] — диапазон [от, до) в произносимом тексте для i-го символа показываемого
export const speakable = (vo, pronounce = {}) => {
  const words = Object.keys(pronounce).sort((a, b) => b.length - a.length);
  const isWord = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  let spoken = '';
  let shown = '';
  const map = [];
  for (let i = 0; i < vo.length; ) {
    if (vo[i] === '[') {
      const j = vo.indexOf(']', i);
      if (j > i) {
        let k = j + 1;
        while (vo[k] === ' ') k++;
        spoken += vo.slice(i, k);
        i = k;
        continue;
      }
    }
    const w = words.find((w) => vo.startsWith(w, i) && !isWord(vo[i - 1]) && !isWord(vo[i + w.length]));
    if (w) {
      const from = spoken.length;
      spoken += pronounce[w];
      for (let k = 0; k < w.length; k++) {
        const a = from + Math.floor((k / w.length) * pronounce[w].length);
        const b = from + Math.max(1, Math.ceil(((k + 1) / w.length) * pronounce[w].length));
        map.push([a, b]);
        shown += vo[i + k];
      }
      i += w.length;
      continue;
    }
    map.push([spoken.length, spoken.length + 1]);
    spoken += vo[i];
    shown += vo[i];
    i++;
  }
  return {spoken, shown, map};
};
