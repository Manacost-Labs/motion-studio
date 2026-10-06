// Пути проекта от места этого файла, а не от папки запуска: скрипт работает и из корня репозитория, и из video/.
// В начале каждой команды: process.chdir(VIDEO) — после этого относительные пути ('public', 'out', '.env') указывают в video/.
// Путь, который пользователь передал аргументом, разбирать через userPath() — он считается от папки, откуда запустили.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const VIDEO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROOT = path.dirname(VIDEO);
export const CALLER = process.cwd(); // папка запуска (запоминается до chdir)

// Аргумент-путь: как его видит пользователь (от папки запуска), иначе — от video/
export const userPath = (p) => {
  const mine = path.resolve(CALLER, p);
  return fs.existsSync(mine) || fs.existsSync(path.dirname(mine)) ? mine : path.resolve(VIDEO, p);
};
