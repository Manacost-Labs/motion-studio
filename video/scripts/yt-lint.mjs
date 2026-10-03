// Проверка раскладки YouTube-ролика без взгляда человека: node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92]
// Рендерит кадры сцен со встроенным зондом (template/lint.tsx, REMOTION_LINT) и собирает из браузера настоящие границы
// надписей: текст за краем кадра, текст на тексте из разных блоков, текст поверх постера или карт веера (data-qa-clear).
// Пишет out/<id>/lint-report.md; код выхода 1, если что-то нашлось. Кадры — посередине и к концу сцен, когда всё
// уже появилось (вход и уход страницы не проверяются — там наложения по замыслу).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {entryPoint} from './studios.mjs';

process.on('unhandledRejection', () => {});
const args = process.argv.slice(2);
const id = args[0];
if (!id || id.startsWith('--')) throw new Error('node scripts/yt-lint.mjs <id> [сцена…] [--at 0.3,0.6,0.92]');
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const pats = args.slice(1).filter((a) => !a.startsWith('--') && a !== opt('at')).map((a) => new RegExp(a));
const at = (opt('at') ?? '0.3,0.6,0.92').split(',').map(Number);

const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const envVariables = {REMOTION_LINT: '1'};
const serveUrl = await bundle({entryPoint: entryPoint('youtube')});
const composition = await selectComposition({serveUrl, id, browserExecutable, envVariables, logLevel: 'error'});
const {timing} = composition.props;
const K = composition.fps / (timing.base ?? 30);
const tmp = path.join(os.tmpdir(), 'yt-lint.jpg');

const found = [];
let checked = 0;
for (const t of timing.segments.filter((s) => !pats.length || pats.some((p) => p.test(s.id)))) {
  for (const q of at) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((t.from + q * t.dur) * K));
    let report;
    await renderStill({
      serveUrl,
      composition,
      frame,
      output: tmp,
      scale: 0.25,
      browserExecutable,
      envVariables,
      logLevel: 'error',
      onBrowserLog: (log) => {
        if (log.text.startsWith('YTLINT ')) report = JSON.parse(log.text.slice(7));
      },
    });
    checked++;
    if (!report) {
      found.push({seg: t.id, sec: frame / composition.fps, kind: 'probe', text: 'зонд не ответил'});
      continue;
    }
    for (const i of report.issues) found.push({seg: t.id, sec: frame / composition.fps, ...i});
  }
}

const what = {edge: 'текст за краем кадра', overlap: 'текст на тексте', clear: 'текст на', probe: 'нет данных'};
const fmt = (i) => `${i.seg} · ${i.sec.toFixed(1)} с — ${what[i.kind]}${i.kind === 'clear' ? ` «${i.other}»` : ''}: «${i.text.slice(0, 40)}»${i.kind === 'overlap' ? ` и «${(i.other ?? '').slice(0, 40)}»` : ''}${i.box ? ` [${Math.round(i.box.left)},${Math.round(i.box.top)}–${Math.round(i.box.right)},${Math.round(i.box.bottom)}]` : ''}`;
// одинаковые находки на соседних кадрах — одной строкой
const uniq = [...new Map(found.map((i) => [`${i.seg}|${i.kind}|${i.text}|${i.other ?? ''}`, i])).values()];
const lines = [`# Раскладка «${id}»`, '', `Кадров проверено: ${checked} · находок: ${uniq.length}`, '', ...uniq.map((i) => `- ${fmt(i)}`)];
fs.mkdirSync(path.resolve('out', id), {recursive: true});
fs.writeFileSync(path.resolve('out', id, 'lint-report.md'), lines.join('\n') + '\n');
console.log(lines.slice(2).join('\n'));
console.log(`→ out/${id}/lint-report.md`);
process.exit(uniq.length ? 1 : 0);
