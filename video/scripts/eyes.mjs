// «Глаза» студии: смотреть чужие ролики (приёмы анимации, темп монтажа) и отбирать геймплей для своих.
//   node scripts/eyes.mjs find "<запрос>" [--yt] [--twitch] [--cc] [--days 30] [--lang ru] [--n 10] [--channels a,b] [--match]
//        геймплей с авторами: YouTube (поиск + лицензия каждого ролика) и Twitch (самые просматриваемые клипы
//        Hearthstone за --days дней). Twitch: с ключами TWITCH_CLIENT_ID/SECRET в .env — по всей категории (язык --lang),
//        без них — по каналам (--channels или TWITCH_CHANNELS ниже) через yt-dlp, клипы других игр отсеиваются.
//        Запрос фильтрует названия клипов Twitch только с --match (названия клипов обычно случайные).
//        Без --yt/--twitch — оба. Пишет out/eyes/find-<запрос>.md (+ .json): автор, канал, просмотры, дата, права
//   node scripts/eyes.mjs search "<запрос>" [--cc] [--n 10]
//        быстрый поиск на YouTube без лицензий; --cc — только Creative Commons
//   node scripts/eyes.mjs look <url | файл> [--from 0] [--to 300] [--every 2] [--moments 8]
//        скачивает ролик (до 720p, целиком — в кэш out/eyes/src/) и по отрезку пишет out/eyes/<имя>/: лист кадров с таймкодами (sheet-*.jpg), склейки и средняя
//        длина плана (темп монтажа), активность по секундам, самые динамичные моменты — каждый полоской из 6 кадров
//        через 0,2 с (moment-*.jpg: так видно, как устроен переход или анимация), и report.md со всем этим
//   node scripts/eyes.mjs scenes <url | файл> [--from 0] [--to 600] [--min 1.5]
//        планы по склейкам (PySceneDetect): начало, конец, длина каждого плана и полоска из 3 кадров (начало, середина,
//        конец) — out/eyes/<имя>/scenes.md. Длинные планы — кандидаты на врезку геймплея; в своей записи без склеек
//        «планами» становятся резкие смены картинки (розыгрыш, смена хода)
//   node scripts/eyes.mjs cut <url | файл> --from 35 --to 52 --name <имя> [--own | --permission "<как получено>"]
//        [--deck "<колода в кадре>"] [--context "<что происходит>"]
//        кусок геймплея → public/clips/<имя>.mp4 (1080p, без звука) + паспорт <имя>.json: источник, автор, лицензия, отрезок,
//        date — дата публикации источника (своя запись — дата файла; yt-qa сверяет её с датой статьи), deck и context.
//        Чужое видео: Creative Commons (CC BY — автор в кадре, поле credit во врезке clip) или разрешение автора
//        (--permission "написал в Telegram 03.10, ответил да" — сохраняется в .json). Своя запись (OBS) — с --own.
// Указание автора — не разрешение: клипы Twitch и обычные ролики YouTube без согласия автора в ролик не берём
// (на монетизируемом канале — Content ID и жалобы). Смотреть можно что угодно.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadEnv} from './lib/env.mjs';
import {mmss as clock} from './lib/text.mjs';

const [cmd, target, ...rest] = process.argv.slice(2);
const opt = (n, d) => (rest.includes(`--${n}`) ? rest[rest.indexOf(`--${n}`) + 1] : d);
const flag = (n) => rest.includes(`--${n}`);
const run = (bin, args, o = {}) => {
  const r = spawnSync(bin, args, {encoding: 'utf8', maxBuffer: 1 << 28, ...o});
  if (r.status) throw new Error(`${bin}: ${(r.stderr || r.stdout || '').slice(-600)}`);
  return r;
};
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};
const isUrl = (s) => /^https?:\/\//.test(s ?? '');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'video';
const FONT = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
const CC = /creative commons/i;
const isTwitch = (s) => /twitch\.tv/.test(s ?? '');
// русскоязычные каналы с Hearthstone для поиска без ключей Twitch API (дополнять: --channels или здесь)
const TWITCH_CHANNELS = ['silvername'];

// метаданные ролика или клипа (лицензия, автор, длительность, игра) без скачивания
const meta = (url) => JSON.parse(run('yt-dlp', ['--dump-json', '--skip-download', '--no-warnings', url]).stdout);
const author = (info) => info.channel ?? info.uploader ?? '?'; // у клипа Twitch channel — стример, uploader — кто нарезал

// ролик целиком в кэш out/eyes/src/ (обычный загрузчик yt-dlp: 10 мин 720p — секунды; скачивание отрезка через ffmpeg
// YouTube подвешивает), отрезок потом вырезается локально. Файл — как есть
const fetchPart = (src, h = 720) => {
  if (!isUrl(src)) return path.resolve(src);
  const file = path.resolve('out', 'eyes', 'src', `${crypto.createHash('sha1').update(src).digest('hex').slice(0, 12)}-${h}.mp4`);
  const fmt = `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][format_id!*=portrait]/b[height<=${h}]`;
  if (!fs.existsSync(file)) run('yt-dlp', ['-f', fmt, '--merge-output-format', 'mp4', '--no-warnings', '--no-progress', '-o', file, src]);
  return file;
};
const spanOf = (from, to) => ['-ss', String(from), '-t', String(to - from)];

const env = loadEnv(); // video/.env (lib/env.mjs): значения не печатаются
const mmss = (s) => clock(s, true); // до ближайшей секунды; '?' — только если времени нет
const ymd = (d) => (d ? `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}` : '?');
const rightsOf = (site, license) =>
  site === 'YouTube' && CC.test(license ?? '') ? 'CC BY — можно, автор в кадре' : site === 'Twitch' ? 'нужно разрешение стримера' : 'нужно разрешение автора';

// YouTube: поиск с полными данными каждого ролика (лицензия, канал, просмотры) — одним запуском yt-dlp
const findYoutube = (q, n, days) => {
  // --cc — только Creative Commons (sp=EgIwAQ==); --days — выдача по дате загрузки (sp=CAI=)
  const sp = flag('cc') ? 'EgIwAQ%253D%253D' : days ? 'CAI%253D' : '';
  const url = sp ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=${sp}` : `ytsearch${n}:${q}`;
  const lines = spawnSync('yt-dlp', ['--dump-json', '--skip-download', '--no-warnings', '--ignore-errors', '--playlist-end', String(n), url], {encoding: 'utf8', maxBuffer: 1 << 28}).stdout.trim().split('\n').filter(Boolean);
  const since = days ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10).replace(/-/g, '') : '';
  return lines
    .map((l) => JSON.parse(l))
    .filter((v) => !since || (v.upload_date ?? '') >= since)
    .map((v) => ({site: 'YouTube', title: v.title, author: author(v), channelUrl: v.channel_url ?? v.uploader_url, url: v.webpage_url, views: v.view_count, date: v.upload_date, duration: v.duration, license: v.license ?? 'стандартная YouTube', rights: rightsOf('YouTube', v.license)}));
};

// Twitch с ключами: Helix API — самые просматриваемые клипы категории Hearthstone за период
const findTwitchApi = async (q, n, days, lang, match) => {
  const id = env.TWITCH_CLIENT_ID;
  const tok = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {method: 'POST'}).then((r) => r.json());
  if (!tok.access_token) fail(`Twitch: ключи не подошли (${tok.message ?? tok.status}) — проверьте TWITCH_CLIENT_ID/SECRET в video/.env`);
  const get = (p) => fetch(`https://api.twitch.tv/helix/${p}`, {headers: {'Client-Id': id, Authorization: `Bearer ${tok.access_token}`}}).then((r) => r.json());
  const game = (await get('games?name=Hearthstone')).data?.[0]?.id ?? '138585';
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const out = [];
  let after = '';
  for (let page = 0; page < 10 && out.length < n; page++) {
    const r = await get(`clips?game_id=${game}&started_at=${since}&ended_at=${new Date().toISOString()}&first=100${after ? `&after=${after}` : ''}`);
    for (const c of r.data ?? []) {
      if (lang && c.language !== lang) continue;
      if (match && !words.some((w) => c.title.toLowerCase().includes(w))) continue;
      out.push({site: 'Twitch', title: c.title, author: c.broadcaster_name, clipper: c.creator_name, channelUrl: `https://www.twitch.tv/${c.broadcaster_name.toLowerCase()}`, url: c.url, views: c.view_count, date: c.created_at.slice(0, 10).replace(/-/g, ''), duration: c.duration, license: 'клип Twitch', rights: rightsOf('Twitch')});
    }
    after = r.pagination?.cursor;
    if (!after) break;
  }
  return out.slice(0, n);
};

// Twitch без ключей: топ клипов каналов через yt-dlp, затем полные данные — чтобы отсеять клипы других игр
const findTwitchChannels = (q, n, days, channels, match) => {
  const range = days <= 1 ? '24hr' : days <= 7 ? '7d' : days <= 30 ? '30d' : 'all';
  const urls = channels.flatMap((ch) =>
    spawnSync('yt-dlp', ['--flat-playlist', '--dump-json', '--playlist-end', String(n * 2), '--no-warnings', `https://www.twitch.tv/${ch}/clips?filter=clips&range=${range}`], {encoding: 'utf8', maxBuffer: 1 << 28})
      .stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).url),
  );
  if (!urls.length) return [];
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return spawnSync('yt-dlp', ['--dump-json', '--skip-download', '--no-warnings', '--ignore-errors', ...urls], {encoding: 'utf8', maxBuffer: 1 << 28})
    .stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((c) => (c.categories ?? []).some((g) => /hearthstone/i.test(g)))
    .filter((c) => !match || words.some((w) => c.title.toLowerCase().includes(w)))
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, n)
    .map((c) => ({site: 'Twitch', title: c.title, author: c.channel, clipper: c.uploader, channelUrl: `https://www.twitch.tv/${(c.channel ?? '').toLowerCase()}`, url: c.webpage_url, views: c.view_count, date: c.upload_date, duration: c.duration, license: 'клип Twitch', rights: rightsOf('Twitch')}));
};

if (cmd === 'find') {
  if (!target) fail('node scripts/eyes.mjs find "<запрос>" [--yt] [--twitch] [--days 30] [--lang ru] [--n 10] [--channels a,b] [--match]');
  const n = Number(opt('n', 10));
  const days = Number(opt('days', 30));
  const both = !flag('yt') && !flag('twitch');
  const found = [];
  if (both || flag('yt')) found.push(...findYoutube(target, n, flag('days') ? days : 0));
  if (both || flag('twitch')) {
    if (env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) found.push(...(await findTwitchApi(target, n, days, opt('lang', 'ru'), flag('match'))));
    else {
      const channels = opt('channels')?.split(',') ?? TWITCH_CHANNELS;
      console.log(`Twitch: ключей API нет (.env.example) — ищу по каналам: ${channels.join(', ')}`);
      found.push(...findTwitchChannels(target, n, days, channels, flag('match')));
    }
  }
  const rows = found.map((f, i) => `| ${i + 1} | ${f.site} | [${f.author}](${f.channelUrl})${f.clipper && f.clipper !== f.author ? ` (клип: ${f.clipper})` : ''} | [${(f.title ?? '').replace(/\|/g, '/').slice(0, 70)}](${f.url}) | ${mmss(f.duration)} | ${f.views ?? '?'} | ${ymd(f.date)} | ${f.rights} |`);
  const report = [`# Геймплей: «${target}»`, '', `YouTube — по запросу${flag('days') ? ` за ${days} дн.` : ''}; Twitch — самые просматриваемые клипы Hearthstone за ${days} дн.`, '', '| # | где | автор | что | длина | просмотры | дата | права |', '|---|---|---|---|---|---|---|---|', ...rows, '', 'Дальше: `eyes.mjs look <ссылка>` — посмотреть; `eyes.mjs cut <ссылка> --from … --to … --name …` — взять отрезок.', 'Без CC BY нужно согласие автора: написать ему (ссылка на канал выше) и передать ответ в `cut --permission "…"`.'].join('\n');
  const out = path.resolve('out', 'eyes', `find-${slug(target)}`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(`${out}.md`, report + '\n');
  fs.writeFileSync(`${out}.json`, JSON.stringify(found, null, 1) + '\n');
  found.forEach((f, i) => console.log(`${String(i + 1).padStart(2)}. ${f.site.padEnd(7)} ${mmss(f.duration).padStart(5)}  ${String(f.views ?? '?').padStart(7)}  ${ymd(f.date)}  ${(f.author ?? '').slice(0, 18).padEnd(18)} ${(f.title ?? '').slice(0, 52)}\n    ${f.url} — ${f.rights}`));
  console.log(`→ ${path.relative(process.cwd(), out)}.md`);
} else if (cmd === 'search') {
  if (!target) throw new Error('node scripts/eyes.mjs search "<запрос>" [--cc] [--n 10]');
  const n = Number(opt('n', 10));
  // sp=EgIwAQ%3D%3D — фильтр YouTube «Creative Commons»
  const url = flag('cc') ? `https://www.youtube.com/results?search_query=${encodeURIComponent(target)}&sp=EgIwAQ%253D%253D` : `ytsearch${n}:${target}`;
  const lines = run('yt-dlp', ['--flat-playlist', '--dump-json', '--playlist-end', String(n), '--no-warnings', url]).stdout.trim().split('\n').filter(Boolean);
  for (const l of lines) {
    const v = JSON.parse(l);
    const dur = v.duration ? `${Math.floor(v.duration / 60)}:${String(Math.round(v.duration % 60)).padStart(2, '0')}` : '?';
    console.log(`${dur.padStart(6)}  ${(v.channel ?? v.uploader ?? '').slice(0, 24).padEnd(24)}  ${(v.title ?? '').slice(0, 70)}\n        https://www.youtube.com/watch?v=${v.id}`);
  }
  if (flag('cc')) console.log('\nлицензию каждого ролика всё равно проверяет cut (поле license) — фильтр поиска не гарантия');
} else if (cmd === 'look') {
  if (!target) throw new Error('node scripts/eyes.mjs look <url | файл> [--from 0] [--to 300] [--every 2] [--moments 8]');
  const from = Number(opt('from', 0));
  const to = Number(opt('to', 300));
  const every = Number(opt('every', 2));
  const info = isUrl(target) ? meta(target) : {title: path.basename(target)};
  const outDir = path.resolve('out', 'eyes', slug(`${info.title}-${from}-${to}`));
  fs.mkdirSync(outDir, {recursive: true});
  const file = fetchPart(target);
  const off = from; // время в отчёте — по исходному ролику
  const span = spanOf(from, to);

  // лист кадров с таймкодами: каждые every секунд, 6×5 на лист
  run('ffmpeg', ['-v', 'error', '-y', ...span, '-i', file, '-vf', `fps=1/${every},scale=384:-2,drawtext=${FONT}:text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x5`, path.join(outDir, 'sheet-%02d.jpg')]);

  // склейки (scene > 0.3) и активность (средняя разница соседних кадров) — 10 кадров в секунду
  const sc = run('ffmpeg', ['-v', 'error', ...span, '-i', file, '-an', '-vf', "fps=10,scale=320:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-", '-f', 'null', '-']).stdout;
  const cuts = [];
  let t = 0;
  for (const line of sc.split('\n')) {
    const pt = line.match(/pts_time:([\d.]+)/);
    if (pt) t = +pt[1];
    const s = line.match(/scene_score=([\d.]+)/);
    if (s && +s[1] > 0.3) cuts.push(t);
  }
  const mo = run('ffmpeg', ['-v', 'error', ...span, '-i', file, '-an', '-vf', 'fps=10,scale=320:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']).stdout;
  const perSec = new Map();
  t = 0;
  for (const line of mo.split('\n')) {
    const pt = line.match(/pts_time:([\d.]+)/);
    if (pt) t = +pt[1];
    const y = line.match(/YAVG=([\d.]+)/);
    if (y) perSec.set(Math.floor(t), (perSec.get(Math.floor(t)) ?? 0) + +y[1] / 10);
  }
  const secs = [...perSec.entries()].sort((a, b) => a[0] - b[0]);
  const dur = secs.length;

  // самые динамичные моменты: пики активности не ближе 4 с друг к другу; каждый — 6 кадров через 0,2 с
  const peaks = [];
  for (const [s, e] of [...secs].sort((a, b) => b[1] - a[1])) {
    if (peaks.length >= Number(opt('moments', 8))) break;
    if (peaks.every((p) => Math.abs(p.s - s) >= 4)) peaks.push({s, e});
  }
  peaks.sort((a, b) => a.s - b.s);
  const moments = peaks.map((p, i) => {
    const img = path.join(outDir, `moment-${String(i + 1).padStart(2, '0')}-${Math.round(p.s + off)}s.jpg`);
    const at = Math.max(0, p.s + from - 0.4);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-t', '1.2', '-i', file, '-frames:v', '1', '-vf', `fps=5,scale=320:-2,drawtext=${FONT}:text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x1`, img]);
    return {t: p.s + off, energy: p.e, img};
  });

  const bar = (e, max) => '█'.repeat(Math.round((e / max) * 20));
  const maxE = Math.max(...secs.map((s) => s[1]), 1e-6);
  const report = [
    `# ${info.title}`,
    '',
    isUrl(target) ? `${target} · автор: ${author(info)} · лицензия: ${info.license ?? (isTwitch(target) ? 'клип Twitch' : 'стандартная YouTube')} · отрезок ${from}–${to} с` : `файл ${target} · отрезок ${from}–${to} с`,
    '',
    `**Темп монтажа:** склеек ${cuts.length} за ${dur} с → средняя длина плана ${cuts.length ? (dur / (cuts.length + 1)).toFixed(1) : dur} с`,
    cuts.length ? `Склейки: ${cuts.map((c) => (c + off).toFixed(1)).join(', ')} с` : '',
    '',
    '**Самые динамичные моменты** (полоска — 6 кадров через 0,2 с):',
    ...moments.map((m) => `- ${m.t.toFixed(0)} с — активность ${m.energy.toFixed(1)} — ${path.relative(process.cwd(), m.img)}`),
    '',
    `**Листы кадров** (каждые ${every} с): ${fs.readdirSync(outDir).filter((f) => f.startsWith('sheet-')).map((f) => path.relative(process.cwd(), path.join(outDir, f))).join(', ')}`,
    '',
    '**Активность по секундам:**',
    '```',
    ...secs.map(([s, e]) => `${String(s + off).padStart(5)} с ${bar(e, maxE)}`),
    '```',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), report + '\n');
  console.log(report.split('**Активность')[0]);
  console.log(`→ ${path.relative(process.cwd(), path.join(outDir, 'report.md'))}`);
} else if (cmd === 'scenes') {
  if (!target) fail('node scripts/eyes.mjs scenes <url | файл> [--from 0] [--to 600] [--min 1.5]');
  const from = Number(opt('from', 0));
  const to = Number(opt('to', 600));
  const info = isUrl(target) ? meta(target) : {title: path.basename(target)};
  const outDir = path.resolve('out', 'eyes', slug(`${info.title}-${from}-${to}`));
  fs.mkdirSync(outDir, {recursive: true});
  const file = fetchPart(target);
  const py = path.resolve('.venv-vo/Scripts/python.exe');
  const r = run(py, ['scripts/scenes.py', file, '--from', String(from), '--to', String(to), '--min', opt('min', '1.5')]);
  const off = 0; // scenes.py отдаёт время от начала файла
  const shots = JSON.parse(r.stdout.trim().split('\n').at(-1)).map(([a, b]) => ({a, b, len: b - a}));
  const rows = shots.slice(0, 60).map((s, i) => {
    const img = path.join(outDir, `shot-${String(i + 1).padStart(2, '0')}.jpg`);
    const pts = [s.a + 0.2, (s.a + s.b) / 2, Math.max(s.a + 0.2, s.b - 0.3)];
    run('ffmpeg', ['-v', 'error', '-y', ...pts.flatMap((t) => ['-ss', t.toFixed(2), '-i', file]), '-filter_complex', `${pts.map((_, k) => `[${k}]scale=320:-2,setsar=1[v${k}]`).join(';')};${pts.map((_, k) => `[v${k}]`).join('')}hstack=inputs=3`, '-frames:v', '1', img]);
    return `| ${i + 1} | ${mmss(s.a + off)} | ${mmss(s.b + off)} | ${s.len.toFixed(1)} с${s.len > 8 ? ' ★' : ''} | ${path.relative(process.cwd(), img)} |`;
  });
  const avg = shots.length ? shots.reduce((n, s) => n + s.len, 0) / shots.length : 0;
  const report = [
    `# Планы: ${info.title}`,
    '',
    isUrl(target) ? `${target} · автор: ${author(info)} · отрезок ${from}–${to} с` : `файл ${target} · отрезок ${from}–${to} с`,
    '',
    `Планов ${shots.length}, средняя длина ${avg.toFixed(1)} с. ★ — план длиннее 8 с (кандидат на врезку геймплея).`,
    '',
    '| # | начало | конец | длина | кадры (начало · середина · конец) |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'scenes.md'), report + '\n');
  console.log(report);
  console.log(`→ ${path.relative(process.cwd(), path.join(outDir, 'scenes.md'))}`);
} else if (cmd === 'cut') {
  const from = Number(opt('from'));
  const to = Number(opt('to'));
  const name = opt('name');
  if (!target || !name || !(to > from)) throw new Error('node scripts/eyes.mjs cut <url | файл> --from 35 --to 52 --name <имя> [--own | --permission "<как получено>"] [--deck "<колода>"] [--context "<что в кадре>"]');
  const info = isUrl(target) ? meta(target) : {title: path.basename(target)};
  const site = isTwitch(target) ? 'Twitch' : 'YouTube';
  const cc = isUrl(target) && CC.test(info.license ?? '');
  const permission = opt('permission');
  if (isUrl(target) && !cc && !permission)
    fail(`лицензия: «${info.license ?? (site === 'Twitch' ? 'клип Twitch, открытой лицензии нет' : 'стандартная YouTube')}» — указание автора не даёт права брать в ролик. Нужна Creative Commons (find), согласие автора (--permission "как и когда получено") или своя запись (--own)`);
  if (isTwitch(target) && !(info.categories ?? []).some((g) => /hearthstone/i.test(g))) console.warn(`⚠ клип из категории «${(info.categories ?? ['?']).join(', ')}», не Hearthstone`);
  if (!isUrl(target) && !flag('own')) fail('локальный файл — только своя запись: добавьте --own');
  const src = fetchPart(target, 1080);
  const out = path.resolve('public', 'clips', `${name}.mp4`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  run('ffmpeg', ['-v', 'error', '-y', ...spanOf(from, to), '-i', src, '-an', '-vf', 'scale=-2:1080:flags=lanczos', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', out]);
  const credit = isUrl(target) ? `Геймплей: ${author(info)} · ${site}${cc ? ' · CC BY' : ''}` : 'Геймплей: запись Манакоста';
  // дата источника: публикация ролика (upload_date) или, у своей записи, дата файла
  const date = isUrl(target) ? info.upload_date?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : fs.statSync(target).mtime.toISOString().slice(0, 10);
  const passport = {source: isUrl(target) ? target : 'своя запись', title: info.title, author: isUrl(target) ? author(info) : 'Манакост', clipper: site === 'Twitch' ? info.uploader : undefined, license: isUrl(target) ? (cc ? info.license : 'по согласию автора') : 'своя запись', permission, date, deck: opt('deck'), context: opt('context'), from, to, credit};
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(passport, null, 1) + '\n');
  if (!passport.deck) console.warn('⚠ в паспорте нет --deck: какая колода в кадре (по нему видно, что врезка от той колоды)');
  console.log(`→ public/clips/${name}.mp4 (+ .json)\nво врезке: {kind: 'clip', src: 'clips/${name}.mp4', start: 0, credit: '${credit}', at: '…', to: '…'}`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'));
}
