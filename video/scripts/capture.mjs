// Снимает страницы hearthpulse.net в 2x и сохраняет координаты блоков для кадрирования.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import {VIDEO} from './lib/paths.mjs';
import {CHROME} from './lib/remotion.mjs';

process.chdir(VIDEO);

const OUT = path.resolve('capture');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home', '/'],
  ['meta', '/standard/meta'],
  ['archetypes', '/standard/archetypes'],
  ['vsgold', '/standard/vicious-gold'],
  ['cards', '/standard/cards'],
  ['card-aya', '/standard/cards/standard/JAIL_504'],
  ['fundecks', '/standard/fun-decks'],
  ['classes', '/classes'],
  ['tierlist', '/tierlist'],
  ['legendaries', '/legendaries'],
  ['heroes', '/heroes'],
  ['library', '/library'],
  ['bg-tierlist', '/battlegrounds/tier-list'],
  ['cosmetics', '/cosmetics'],
  ['articles', '/articles'],
];
const only = process.argv.slice(2);
const MAX_H = 4200;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});

for (const [name, url] of PAGES) {
  if (only.length && !only.includes(name)) continue;
  const page = await browser.newPage();
  await page.goto('https://hearthpulse.net' + url, { waitUntil: 'networkidle2', timeout: 90000 });
  // Прокрутка, чтобы подгрузились ленивые картинки
  await page.evaluate(async (maxH) => {
    for (let y = 0; y < maxH; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
    window.scrollTo(0, 0);
  }, MAX_H);
  await new Promise(r => setTimeout(r, 2500));

  const blocks = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const out = [];
    const walk = (el, d) => {
      if (d > 5) return;
      for (const c of el.children) {
        const r = c.getBoundingClientRect();
        if (r.height > 40 && r.width > 150) {
          out.push({
            d, tag: c.tagName, cls: (c.className || '').toString().slice(0, 80),
            x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY),
            w: Math.round(r.width), h: Math.round(r.height),
            txt: c.innerText.replace(/\s+/g, ' ').slice(0, 80),
          });
          walk(c, d + 1);
        }
      }
    };
    walk(main, 0);
    return { total: document.documentElement.scrollHeight, blocks: out };
  });
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(blocks, null, 1));

  const h = Math.min(blocks.total, MAX_H);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: 0, width: 1440, height: h }, captureBeyondViewport: true });
  console.log(`${name}: ${blocks.blocks.length} blocks, page ${blocks.total}px, shot ${h}px`);
  await page.close();
}
await browser.close();
