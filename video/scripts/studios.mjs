// Студии — реестр src/studios/studios.json, логика — scripts/lib/studios.mjs (этот файл — прежний путь импорта и справка из консоли).
//   node scripts/studios.mjs                 — таблица студий
//   node scripts/studios.mjs get <ключ>       — запись реестра одной строкой JSON (render.ps1)
//   node scripts/studios.mjs of <id> [ключ]   — ключ студии композиции (папка ролика или префикс id; иначе ключ по умолчанию)
//   node scripts/studios.mjs videos [вид]     — id роликов с config.ts (вид: ads | features | youtube), по строке (pre-commit)
//   node scripts/studios.mjs dirs [вид]       — папки студий этого вида, по строке (pre-commit)
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {STUDIOS, studio, studioOf, videosOf} from './lib/studios.mjs';

export * from './lib/studios.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  const ofKind = (kind) => STUDIOS.filter((s) => !kind || s.kind === kind);
  try {
    if (cmd === 'get') console.log(JSON.stringify(studio(a)));
    else if (cmd === 'of') console.log(studioOf(a, b).key);
    else if (cmd === 'videos') console.log(ofKind(a).flatMap((s) => videosOf(s.key)).join('\n'));
    else if (cmd === 'dirs') console.log(ofKind(a).map((s) => s.dir).join('\n'));
    else if (!cmd) for (const s of STUDIOS) console.log(`${s.key.padEnd(9)} ${s.dir.padEnd(17)} ${s.kind.padEnd(9)} порт ${s.port}  ${s.idPrefix ? `id ${s.idPrefix}…` : 'id свободные'}  ${s.title}`);
    else throw new Error(`неизвестная команда «${cmd}»: get | of | videos | dirs`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
