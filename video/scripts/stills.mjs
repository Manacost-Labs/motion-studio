// Рендерит контрольные кадры: node scripts/stills.mjs [HearthPulseAd16x9] 30 125 200 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const id = isNaN(Number(args[0])) ? args.shift() : 'HearthPulseAd';
const frames = args.map(Number);
const outDir = path.resolve('out/stills', id);
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const composition = await selectComposition({serveUrl, id, browserExecutable});

for (const frame of frames) {
  const output = path.join(outDir, `f${String(frame).padStart(3, '0')}.jpg`);
  await renderStill({serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 85, scale: 0.5, browserExecutable});
  console.log(output);
}
