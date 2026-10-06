// ffmpeg / ffprobe для скриптов. По умолчанию ошибка программы — исключение с хвостом её вывода (check: false — вернуть как есть).
import {spawnSync} from 'node:child_process';

export const run = (bin, args, {check = true, ...o} = {}) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 1 << 28, ...o});
  if (r.error) throw new Error(`${bin}: ${/** @type {NodeJS.ErrnoException} */ (r.error).code === 'ENOENT' ? 'не найден в PATH (node scripts/doctor.mjs)' : r.error.message}`);
  if (check && r.status) throw new Error(`${bin} (код ${r.status}): ${String(r.stderr || r.stdout || '').slice(-600)}`);
  return r;
};
export const ff = (args, o) => run('ffmpeg', args, o);
export const ffprobe = (args, o) => run('ffprobe', args, o);

// Длительность файла в секундах
export const probeDur = (file) => Number(ffprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
// Размер картинки или первого видеопотока: [ширина, высота]
export const dims = (file) => ffprobe(['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).stdout.trim().split(/\r?\n/)[0].split(',').map(Number);
