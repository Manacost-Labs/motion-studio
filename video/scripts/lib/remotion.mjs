// Remotion для скриптов: браузер рендера, сборка студии, композиция по id.
// Браузер — системный Chrome (как у render.ps1); другой путь — переменная окружения CHROME_PATH.
// Пакеты Remotion подгружаются только при вызове: скриптам, которым нужен лишь CHROME (capture, fetch-article), они не мешают.
import fs from 'node:fs';
import {entryPoint, studioOf} from './studios.mjs';

export const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Сборка точки входа студии (webpack кэширует между запусками в node_modules/.cache).
// bundle() кладёт сборку с копией public/ (~0,7 ГБ) в %TEMP% и сам её не удаляет — убираем при выходе процесса,
// иначе каждый запуск проверок оставляет по сборке, и диск кончается (ENOSPC).
export const bundleStudio = async (key) => {
  const dir = await (await import('@remotion/bundler')).bundle({entryPoint: entryPoint(key)});
  process.once('exit', () => {
    try {
      fs.rmSync(dir, {recursive: true, force: true, maxRetries: 3});
    } catch {} // занята — уберёт очистка временных файлов Windows
  });
  return dir;
};

// Шрифты шаблонов (loadFont) в Node не грузятся и дают необработанные отказы промисов — их молча пропускаем.
// Любой другой отказ печатается, и код выхода становится 1: скрипт проверки не должен «пройти» с неполным отчётом.
export const quietFonts = () => {
  process.on('unhandledRejection', (/** @type {any} */ e) => {
    const text = `${e?.message ?? e}\n${e?.stack ?? ''}`;
    if (/font|FontFace|\.woff2?|\.ttf|\.otf/i.test(text)) return;
    console.error(`⚠ необработанная ошибка: ${e?.stack ?? e}`);
    process.exitCode = 1;
  });
};

// Композиция по id: студия — из studios.json (папка ролика или префикс id; studio — явно), сборка, selectComposition
/** @param {string} id @param {{studio?: string, fallback?: string, [option: string]: any}} [options] */
export const openComposition = async (id, {studio, fallback, ...opts} = {}) => {
  const key = studio ?? studioOf(id, fallback).key;
  const serveUrl = await bundleStudio(key);
  const {selectComposition} = await import('@remotion/renderer');
  const composition = await selectComposition({serveUrl, id, browserExecutable: CHROME, ...opts});
  return {key, serveUrl, composition};
};
