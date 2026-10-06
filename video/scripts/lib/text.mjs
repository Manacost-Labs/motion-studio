// Общие форматы текста для скриптов: время, имена файлов, субтитры.

const pad = (n, l = 2) => String(n).padStart(l, '0');

// Секунды → «м:сс». round — до ближайшей секунды (по умолчанию вниз, как часы). '?' — только если времени нет.
// mmss(0) = '0:00', mmss(119.6) = '1:59', mmss(119.6, true) = '2:00'
export const mmss = (sec, round = false) => {
  if (sec === undefined || sec === null || !Number.isFinite(Number(sec))) return '?';
  const t = Math.max(0, round ? Math.round(Number(sec)) : Math.floor(Number(sec)));
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
};

// Секунды → время .srt «чч:мм:сс,мсс»
export const srtTime = (sec) => {
  const ms = Math.round(sec * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

// Строка → имя файла: буквы и цифры любого алфавита, остальное — дефис. ext: true — сначала отрезать расширение
// slug('Граб\'Зи — 2.mp4', {ext: true}) = 'Граб-Зи-2'; {lower: true, max: 48, fallback: 'video'} — короткое имя в нижнем регистре
export const slug = (s, {lower = false, max = 0, ext = false, fallback = ''} = {}) => {
  let r = String(s ?? '');
  if (ext) r = r.replace(/\.[^.]+$/, '');
  if (lower) r = r.toLowerCase();
  r = r.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  if (max) r = r.slice(0, max).replace(/-$/, '');
  return r || fallback;
};

// Регистрация ролика в videos.ts студии: импорт после последнего import и строка в конце списка VIDEOS.
// Концы строк файла (LF или CRLF — core.autocrlf) сохраняются. Разметка не та — null (не портить файл вставкой «куда-нибудь»)
// addVideo(text, {constName: 'YT_X', id: 'yt-x', note: '«Тема» — черновик'}) → новый текст | null
export const addVideo = (text, {constName, id, note}) => {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const imports = [...text.matchAll(/^import .*;\r?$/gm)];
  const list = /^export const VIDEOS\b[^=]*= \[\r?\n[\s\S]*?^\];\r?$/m.exec(text);
  if (!imports.length || !list) return null;
  const end = list.index + list[0].lastIndexOf('];');
  let out = text.slice(0, end) + `  ${constName}, // ${note}${eol}` + text.slice(end);
  const last = imports.at(-1);
  const at = last.index + last[0].replace(/\r$/, '').length;
  out = out.slice(0, at) + `${eol}import {${constName}} from './${id}/config';` + out.slice(at);
  return out;
};
