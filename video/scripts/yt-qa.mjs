// Автопроверка качества YouTube-ролика: node scripts/yt-qa.mjs <id> [--video out/<id>/video.mp4] [--no-video] [--allow-todo]
// 1) данные ролика (core/qa/audit.ts + проверки канала и сцен — channel.qa, SceneDef.audit): голос, субтитры, простои колоды, длина надписей, главы и SEO, темп, обложки;
// 2) ассеты: рендеры карт, постеры, врезки и их паспорта (лицензия), музыка (лицензия в public/lib/manifest.json), голос;
// 3) произношение: слова, которые распознавание услышало иначе, чем написано (out/<id>/vo-raw/<сцена>.words.json);
//    термины (имена, карты, сокращения) — предупреждением с подсказкой пополнить словарь игры games/<игра>/data/pronounce.json;
// 4) свежесть файлов к загрузке: description.txt, subtitles.srt, обложки не старше конфига и голоса;
// 5) готовое видео: параметры файла (4K60, yuv420p, BT.709, AAC 48 кГц, длина), громкость и пики, чёрные и застывшие
//    кадры, рывки вне стыков сцен, провалы звука; пробная врезка (probe) в видео — ошибка.
// Пишет out/<id>/qa-report.md, pace.md (карта темпа по минутам) и qa.json (для release.mjs). Код выхода 1, если есть ❌.
// --allow-todo — ❌ «не заполнено (TODO)» не дают кода 1 (черновик заготовки; так зовёт pre-commit при правке общего кода),
// в отчёте они остаются ошибками.
import fs from 'node:fs';
import path from 'node:path';
import {ff, ffprobe} from './lib/media.mjs';
import {VIDEO, userPath} from './lib/paths.mjs';
import {openComposition, quietFonts} from './lib/remotion.mjs';
import {findVideo, studio} from './lib/studios.mjs';
import {channelTexts, forbiddenIn, loadBrand, loadChannel} from './lib/channel.mjs';
import {mmss} from './lib/text.mjs';
import {align, dictionary, lev, readWords, tokens} from './vo-lib.mjs';

process.chdir(VIDEO);
quietFonts(); // шрифты шаблона в Node не грузятся — для проверки они не нужны

const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-qa.mjs <id> [--video файл] [--no-video] [--allow-todo]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const issues = [];
const add = (level, seg, what) => issues.push({level, seg, what});

// ── 1. Данные ролика: тайминг из композиции + проверки шаблона ──
const {key, composition: comp} = await openComposition(id, {fallback: 'youtube'});
const {config, timing} = /** @type {{config: any, timing: any}} */ (comp.props);
const own = (() => {
  try {
    return findVideo(id); // папка ролика (у демо канала её нет — конфиг в motion-showcase/demo.ts)
  } catch {
    return null;
  }
})();
// канал студии (src/studios/<папка>/channel.ts) с проверками core/qa/audit.ts — scripts/lib/channel.mjs
const {LIMITS, qa} = await loadChannel(key, 'yt-qa');
const {audit, assetsOf, expectedJumps, paceOf} = qa;
for (const i of audit(config, timing)) add(i.level, i.seg, i.what);

// Право (legal в src/brands/<brand>/channel.ts; политика правообладателя — GAME.md игры, «Право»):
// legal.forbidden — товарные знаки правообладателя в названии КАНАЛА (имя, сайт, ссылки и подписи финала, подвал описания) — ❌;
// legal.forbiddenInVideo — слова, выдающие ролик за официальный, в названии, вариантах названия, тегах и хэштегах ролика — ❌;
// legal.forbiddenInTags — товарные знаки, которых по политике правообладателя нельзя в тегах и хэштегах — ❌.
// Упоминание игры в названии ролика (описательно) этой проверкой не запрещается
const brandMod = await loadBrand(key, 'yt-qa');
const {legal} = brandMod;
const brandFile = `src/brands/${studio(key).brand}/channel.ts`;
const inChannel = new Map(); // знак → места в названии канала (одно замечание на знак)
for (const [where, text] of channelTexts(brandMod)) for (const w of forbiddenIn(text, legal.forbidden)) inChannel.set(w, [...(inChannel.get(w) ?? []), `${where} «${text}»`]);
for (const [w, places] of inChannel) add('error', 'право', `товарный знак «${w}» в названии канала — ${places.join(', ')}: убрать (legal.forbidden в ${brandFile})`);
const videoTexts = [['название', config.title], ...(config.seo?.titles ?? []).map((x) => ['вариант названия', x]), ...(config.seo?.tags ?? []).map((x) => ['тег', x]), ...(config.seo?.hashtags ?? []).map((x) => ['хэштег', x])];
for (const [where, text] of videoTexts) {
  const hit = forbiddenIn(text, legal.forbiddenInVideo);
  if (hit.length) add('error', 'право', `«${hit.join('», «')}» выдаёт ролик за официальный — ${where} «${text}»: убрать (legal.forbiddenInVideo в ${brandFile})`);
  const mark = where === 'тег' || where === 'хэштег' ? forbiddenIn(text, legal.forbiddenInTags ?? []) : [];
  if (mark.length) add('error', 'право', `товарный знак «${mark.join('», «')}» в ${where === 'тег' ? 'теге' : 'хэштеге'} «${text}» — политика правообладателя запрещает его как поисковый тег: убрать (legal.forbiddenInTags в ${brandFile})`);
}

// ── 2. Ассеты ──
const pub = (p) => fs.existsSync(path.resolve('public', p));
const need = (p, seg, what) => !pub(p) && add('error', seg, `нет файла ${p} (${what})`);
for (const m of config.music) need(m, 'music', 'музыка');
// файлы сцен — из реестра сцен канала (SceneDef.assets; у колоды — games/hearthstone/data/audit.ts → deckAssets)
for (const a of assetsOf(config)) need(a.file, a.seg, a.what);
const clips = [];
for (const s of config.segments) if (s.kind === 'deck') for (const ins of s.inserts ?? []) if (ins.kind === 'clip') clips.push({seg: s, ins});

// Паспорт врезки public/clips/<клип>.json (eyes.mjs cut, rec.mjs take): без него и без годной лицензии чужое видео в ролик
// не берём. Дата источника сверяется с датой статьи: старый клип — другая сборка колоды
const LICENSE_OK = /^(CC BY|Creative Commons Attribution)|^своя запись$|^по согласию автора$/i;
const articleDate = (() => {
  const f = own && path.join(own.dir, 'article.json');
  return f && fs.existsSync(f) ? String(JSON.parse(fs.readFileSync(f, 'utf8')).date ?? '').slice(0, 10) : '';
})();
for (const {seg, ins} of clips) {
  const file = ins.src.replace(/\.[^.]+$/, '.json');
  const p = pub(file) ? JSON.parse(fs.readFileSync(path.resolve('public', file), 'utf8')) : null;
  if (!p) {
    add('error', seg.id, `у врезки ${ins.src} нет паспорта public/${file} (источник, автор, лицензия) — eyes.mjs cut или rec.mjs take`);
    continue;
  }
  if (!LICENSE_OK.test(p.license ?? '')) add('error', seg.id, `лицензия «${p.license ?? '—'}» в паспорте ${file} — нужна CC BY, своя запись или согласие автора`);
  else if (/по согласию/i.test(p.license) && !p.permission?.trim()) add('error', seg.id, `в паспорте ${file} согласие автора без подробностей (permission: где, когда, что ответил)`);
  if (!p.date) add('warn', seg.id, `в паспорте ${file} нет даты источника (date) — eyes.mjs cut пишет её сам`);
  else if (articleDate && (Date.parse(articleDate) - Date.parse(p.date)) / 864e5 > LIMITS.clipAgeDays)
    add('warn', seg.id, `источник врезки ${ins.src} от ${p.date} — на ${Math.round((Date.parse(articleDate) - Date.parse(p.date)) / 864e5)} дн. старше статьи (${articleDate}): сборка колоды могла измениться`);
  if (!p.deck && !p.context) add('info', seg.id, `в паспорте ${file} не записано, что в кадре (deck/context)`);
}

// Музыка и фон: откуда трек и на каких правах — поле license в public/lib/manifest.json (дорожка «-bed» — производная от трека)
const manifest = pub('lib/manifest.json') ? JSON.parse(fs.readFileSync(path.resolve('public', 'lib', 'manifest.json'), 'utf8')) : {};
for (const [kind, list] of [['music', config.music], ['ambience', config.ambience ?? []]])
  for (const m of list) {
    const k = m.replace(/^lib\//, '');
    const entry = manifest[k] ?? manifest[k.replace(/-bed(\.\w+)$/, '$1')];
    if (!entry) add('warn', kind, `${m}: нет записи в public/lib/manifest.json — откуда трек и на каких правах`);
    else if (!entry.license) add('warn', kind, `${m}: нет license в public/lib/manifest.json (модель ${entry.model ?? '?'}) — записать лицензию или тариф`);
  }

// ── 3. Произношение по распознаванию ──
// Термин (имя, название карты, сокращение) услышан непохоже на написанное — предупреждение: послушать и, если диктор
// читает неверно, добавить в словарь игры (games/<игра>/data/pronounce.json). Обычные слова — к сведению. Слова словаря пишутся
// не так, как читаются, — их не сверяем
const raw = path.resolve('out', id, 'vo-raw');
const skip = new Set(Object.keys({...dictionary(), ...config.pronounce}).map((w) => w.toLowerCase()));
const isTerm = (shown, t) => {
  const word = shown.slice(t.a, t.b);
  const sentenceStart = /(^|[.!?…:—«"(]\s*)$/.test(shown.slice(0, t.a));
  return /['’]/.test(word) || /^[А-ЯЁA-Z]{2,}$/.test(word) || (/^[А-ЯЁA-Z]/.test(word) && !sentenceStart);
};
// похоже: «Грабзи» вместо «Граб'Зи» (так и надо) или другой падеж — «Бездной» вместо «Бездны» (общее начало)
const close = (a, b) => (a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4)) || 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.75;
for (const s of config.segments) {
  const file = path.join(raw, `${s.id}.words.json`);
  if (!fs.existsSync(file)) continue;
  const shown = s.vo.replace(/\[[^\]]*\]\s*/g, '');
  const toks = tokens(shown);
  const heard = readWords(file);
  const m = align(toks, heard);
  // h = null — слово не сопоставилось ни с чем услышанным (прочитано до неузнаваемости или пропущено). Но сначала —
  // склейка услышанного между соседними сопоставленными словами: распознавание дробит имена («Ал 'акир», «Хлад -Ванпир»)
  const gapHeard = (i) => {
    let p = i - 1;
    while (p >= 0 && m[p] < 0) p--;
    let q = i + 1;
    while (q < m.length && m[q] < 0) q++;
    return heard.slice(p >= 0 ? m[p] : 0, q < m.length ? m[q] + 1 : heard.length).map((h) => h.w).join('');
  };
  const odd = toks
    .map((t, i) => ({t, h: m[i] >= 0 ? heard[m[i]] : null, word: shown.slice(t.a, t.b), i}))
    .filter(({t, h, word, i}) => h?.w !== t.w && !/^\d+$/.test(h?.w ?? '') && !skip.has(word.toLowerCase()) && (h || !gapHeard(i).includes(t.w)));
  const terms = odd.filter(({t, h}) => isTerm(shown, t) && t.w.length > 1 && !(h && close(t.w, h.w)));
  const rest = odd.filter((o) => o.h && !terms.includes(o) && o.t.w.length > 3);
  const list = (xs) => xs.map(({word, h}) => `«${word}» → «${h?.text ?? 'не услышано'}»`).join(', ');
  if (terms.length) add('warn', s.id, `термин звучит иначе: ${list(terms)} — послушать; если диктор читает неверно, добавить в src/games/${studio(key).game}/data/pronounce.json ("${terms[0].word}": "как читать") и перезаписать сцену`);
  if (rest.length) add('info', s.id, `послушать: ${list(rest)}`);
}

// ── 4. Свежесть файлов к загрузке: не старше конфига (и статьи) и записи голоса ──
const outDir = path.resolve('out', id);
const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const sources = [
  ...(own ? [own.configPath, path.join(own.dir, 'article.json')] : []).map((f) => ({f, what: path.basename(f)})),
  ...(fs.existsSync(path.resolve('public', 'vo', id)) ? fs.readdirSync(path.resolve('public', 'vo', id)).map((f) => ({f: path.resolve('public', 'vo', id, f), what: `голос ${f}`})) : []),
].filter((s) => fs.existsSync(s.f));
const newest = sources.reduce((a, s) => (mtime(s.f) > mtime(a?.f) ? s : a), null);
const thumbs = ['thumbnail.png', ...(config.thumbs ?? []).slice(0, 2).map((_, i) => `thumbnail-${'bc'[i]}.png`)];
for (const f of ['description.txt', 'subtitles.srt', ...thumbs]) {
  const p = path.join(outDir, f);
  if (newest && fs.existsSync(p) && mtime(p) < mtime(newest.f))
    add('warn', 'выпуск', `${f} старше, чем ${newest.what} (${new Date(mtime(newest.f)).toLocaleString('ru-RU')}) — пересобрать: ${/\.png$/.test(f) ? `node scripts/yt-thumb.mjs ${id}` : `node scripts/yt-export.mjs ${id}`}`);
}

// ── 5. Видео ──
const video = opt('video') ? userPath(opt('video')) : path.resolve('out', id, 'video.mp4');
const K = (config.fps ?? 30) / (timing.base ?? 30);
const probeIns = clips.filter((c) => c.ins.probe);
const report = {checked: false};
if (!args.includes('--no-video') && fs.existsSync(video)) {
  report.checked = true;
  report.path = path.relative(process.cwd(), video);
  // параметры файла: чистовой — 4K 60 к/с (при fps 60), всегда yuv420p, BT.709 (TV-диапазон), AAC 48 кГц, длина как у композиции.
  // Черновик (имя с draft/preview/frag) — без проверки размера и длины. Старый рендер (без лога render.ps1 рядом) по цвету — ⚠
  const info = JSON.parse(ffprobe(['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]).stdout);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const final = !/draft|preview|frag/i.test(path.basename(video));
  const logged = fs.existsSync(video.replace(/\.mp4$/i, '.render.log'));
  const [num, den] = (v?.r_frame_rate ?? '0/1').split('/').map(Number);
  const rate = num / (den || 1);
  const dur = Number(info.format.duration);
  const spec = LIMITS.video;
  report.probe = {w: v?.width, h: v?.height, fps: +rate.toFixed(3), pix: v?.pix_fmt, range: v?.color_range, space: v?.color_space, primaries: v?.color_primaries, transfer: v?.color_transfer, vcodec: v?.codec_name, acodec: a?.codec_name, rate: a?.sample_rate ? Number(a.sample_rate) : null, duration: dur, final, renderLog: logged};
  const old = logged ? 'error' : 'warn';
  const oldNote = logged ? '' : ' (старый рендер без лога render.ps1 — перерендерить новым render.ps1)';
  if (final && (config.fps ?? 30) === spec.fps && !(v?.width === spec.w && v?.height === spec.h && Math.abs(rate - spec.fps) < 0.01))
    add('error', 'video', `файл ${v?.width}×${v?.height} при ${rate.toFixed(2)} к/с — для YouTube нужен ${spec.w}×${spec.h} при ${spec.fps} к/с (render.ps1 -Scale 2)`);
  if (v?.pix_fmt !== spec.pix) add(v?.pix_fmt === 'yuvj420p' ? old : 'error', 'video', `формат пикселей ${v?.pix_fmt} — нужен ${spec.pix}${oldNote}`);
  const color = [v?.color_space, v?.color_primaries, v?.color_transfer];
  if (color.some((c) => c !== spec.color) || v?.color_range !== 'tv') add(old, 'video', `цвет ${color.map((c) => c ?? '—').join('/')}, диапазон ${v?.color_range ?? '—'} — нужен ${spec.color} TV${oldNote}`);
  if (!a) add('error', 'video', 'в файле нет звука');
  else if (a.codec_name !== spec.audio || Number(a.sample_rate) !== spec.rate) add('error', 'video', `звук ${a.codec_name} ${a.sample_rate} Гц — нужен AAC ${spec.rate / 1000} кГц`);
  const want = timing.total / (timing.base ?? 30);
  // звук короче картинки и файл короче композиции — видео обрезано по звуку при сведении (ffmpeg -shortest), а не другой версией ролика
  const cutByAudio = a && Number(a.duration) < want - 1e-3 && dur < want;
  if (final && Math.abs(dur - want) > 1 / (rate || 30) + 1e-3)
    add('error', 'video', `длина файла ${dur.toFixed(3)} с (${v?.nb_frames ?? '?'} кадров), у композиции ${want.toFixed(3)} с — ${cutByAudio ? `обрезано по звуку (звук ${Number(a.duration).toFixed(3)} с, -shortest при сведении в render.ps1)` : 'файл не от этой версии ролика или рендер оборван'}`);
  for (const {seg, ins} of probeIns) add('error', seg.id, `в видео пробная врезка ${ins.src} (probe) — для выпуска заменить своей записью этой колоды или убрать`);

  const loud = ff(['-hide_banner', '-nostats', '-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {check: false}).stderr;
  const last = (re) => Number([...loud.matchAll(re)].at(-1)?.[1]); // итог ebur128 — последние значения в логе
  const I = last(/I:\s+(-?[\d.]+) LUFS/g);
  const TP = last(/Peak:\s+(-?[\d.]+) dBFS/g);
  report.lufs = I;
  report.peak = TP;
  if (!(I >= LIMITS.lufs - LIMITS.lufsTol && I <= LIMITS.lufs + LIMITS.lufsTol)) add('warn', 'video', `громкость ${I} LUFS (норма для YouTube ${LIMITS.lufs} ±${LIMITS.lufsTol})`);
  if (TP > LIMITS.peak) add('error', 'video', `пик ${TP} dBFS — выше ${LIMITS.peak} dBTP, на YouTube возможны искажения`);
  const fps = comp.fps;
  const vlog = ff(['-hide_banner', '-nostats', '-i', video, '-an', '-vf', 'scale=432:-2,blackdetect=d=0.4:pix_th=0.08,freezedetect=n=0.002:d=6', '-f', 'null', '-'], {check: false}).stderr;
  for (const b of vlog.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) add('warn', 'video', `чёрные кадры ${(+b[1]).toFixed(1)}–${(+b[2]).toFixed(1)} с`);
  const totalSec = timing.total / (timing.base ?? 30);
  for (const fz of vlog.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)) {
    const at = +fz[1];
    if (at < totalSec - 22) add('warn', 'video', `кадр стоит ${(+fz[2]).toFixed(1)} с с ${at.toFixed(1)} с`);
  }
  // рывки: резкая смена кадра не на стыке сцены (стык — затемнение через пергамент, ±9 кадров)
  const cuts = timing.segments.slice(1).map((t) => Math.round(t.from * K));
  const zones = expectedJumps(config, timing).map(([a, b]) => [a * K, b * K]); // геймплей во врезках, уход сукна топ-3
  const sc = ff(['-hide_banner', '-i', video, '-an', '-vf', "scale=432:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score:file=-", '-f', 'null', '-'], {check: false}).stdout;
  let n = -1;
  for (const line of sc.split('\n')) {
    const fm = line.match(/^frame:(\d+)/);
    if (fm) n = +fm[1];
    const sm = line.match(/scene_score=([\d.]+)/);
    if (sm && +sm[1] > 0.06 && n > 2 && !cuts.some((c) => Math.abs(c - n) <= 9 * K) && !zones.some(([a, b]) => n >= a && n <= b)) add('warn', 'video', `резкая смена кадра на ${n} (${(n / fps).toFixed(1)} с), сила ${(+sm[1]).toFixed(3)} — посмотреть`);
  }
  const alog = ff(['-hide_banner', '-nostats', '-i', video, '-vn', '-af', 'silencedetect=n=-45dB:d=2', '-f', 'null', '-'], {check: false}).stderr;
  for (const s of alog.matchAll(/silence_start: ([\d.]+)/g)) if (+s[1] < totalSec - 6) add('warn', 'video', `тишина дольше 2 с с ${(+s[1]).toFixed(1)} с`);
} else add('info', 'video', 'видео не проверялось (нет файла или --no-video)');

// ── Карта темпа: что нового по минутам ──
const pace = paceOf(config, timing);
const sec30 = (f) => f / (timing.base ?? 30);
const minutes = Math.ceil(sec30(timing.total) / 60);
const paceLines = [
  `# Темп «${config.title}»`,
  '',
  `Длина ${mmss(sec30(timing.total))}. «Новинка» — врезка, разделитель, заставка топ-3, сцена другого вида; дольше ${LIMITS.paceGapSec} с без неё — ⚠ (зритель устаёт от однообразия). Карты под голос и смена трека музыки — не новинки.`,
  '',
  '| минута | сцены | новое | карт под голос |',
  '|---|---|---|---|',
  ...Array.from({length: minutes}, (_, m) => {
    const ev = pace.events.filter((e) => Math.floor(sec30(e.at) / 60) === m);
    const scenes = [...new Set(ev.filter((e) => e.what !== 'карта').map((e) => e.seg))];
    const news = ev.filter((e) => e.news).map((e) => `${mmss(sec30(e.at))} ${e.what}`);
    return `| ${m}:00–${m + 1}:00 | ${scenes.join(', ') || '—'} | ${news.join('; ') || '—'} | ${ev.filter((e) => e.what === 'карта').length} |`;
  }),
  '',
  pace.gaps.length ? `**Без новинок дольше ${LIMITS.paceGapSec} с:**` : `Пробелов дольше ${LIMITS.paceGapSec} с без новинок нет.`,
  ...pace.gaps.map(([a, b]) => `- ⚠️ ${mmss(sec30(a))}–${mmss(sec30(b))} (${Math.round(sec30(b - a))} с) — врезка геймплея из своей записи (rec.mjs) или сцена cards/matchups в середину`),
];
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'pace.md'), paceLines.join('\n') + '\n');

// ── Отчёт ──
const icon = {error: '❌', warn: '⚠️', info: 'ℹ️'};
const count = (l) => issues.filter((i) => i.level === l).length;
const lines = [`# Проверка «${config.title}»`, '', `Ошибок: ${count('error')} · предупреждений: ${count('warn')} · заметок: ${count('info')}`, ''];
for (const level of ['error', 'warn', 'info']) for (const i of issues.filter((x) => x.level === level)) lines.push(`- ${icon[level]} **${i.seg}** — ${i.what}`);
const reportFile = path.join(outDir, 'qa-report.md');
fs.writeFileSync(reportFile, lines.join('\n') + '\n');
// машиночитаемый итог — его читает release.mjs (замеры видео не повторяются)
const qaJson = {id, date: new Date().toISOString(), counts: {error: count('error'), warn: count('warn'), info: count('info')}, issues, video: report, pace: {gaps: pace.gaps.map(([a, b]) => [sec30(a), sec30(b)])}, probes: probeIns.map((c) => c.ins.src)};
fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(qaJson, null, 1) + '\n');
console.log(lines.slice(2, 3).join(''));
for (const i of issues.filter((x) => x.level !== 'info')) console.log(`${icon[i.level]} ${i.seg}: ${i.what}`);
console.log(`→ ${path.relative(process.cwd(), reportFile)}, pace.md, qa.json`);
// черновик: --allow-todo — незаполненные TODO не останавливают (остальные ❌ — да)
const todo = (i) => i.level === 'error' && /^не заполнено \(TODO\)/.test(i.what);
const blocking = issues.filter((i) => i.level === 'error' && !(args.includes('--allow-todo') && todo(i))).length;
if (args.includes('--allow-todo') && count('error') && !blocking) console.log(`--allow-todo: ❌ только «не заполнено (TODO)» (${count('error')}) — черновик, код 0`);
process.exit(blocking ? 1 : process.exitCode ?? 0);
