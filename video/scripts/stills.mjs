// Рендерит контрольные кадры: node scripts/stills.mjs [--studio ads|features|youtube] [HearthPulseAd16x9] 30 125 200 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {entryPoint} from './studios.mjs';

const args = process.argv.slice(2);
const si = args.indexOf('--studio');
const studio = si < 0 ? 'ads' : args.splice(si, 2)[1];
const id = isNaN(Number(args[0])) ? args.shift() : 'HearthPulseAd';
const frames = args.map(Number);
const outDir = path.resolve('out/stills', id);
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: entryPoint(studio)});
const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const composition = await selectComposition({serveUrl, id, browserExecutable});

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(3, '0')}.jpg`);
  await renderStill({serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 85, scale: 0.5, browserExecutable});
  console.log(output);
}
