// Статья hs-manacost.ru → данные для YouTube-ролика (шаблон src/templates/youtube).
//   node scripts/fetch-article.mjs <url> <папка ролика в src/ads>
// Пишет src/ads/<папка>/article.json: вступление, разделы-колоды (место, название, класс, код, абзацы,
// упомянутые в тексте карты, 30 карт колоды из кода) и финал. Картинки карт кэшируются в public/hs:
//   tiles/<id>.png — полоски для списка колоды, render/<id>.png — карта целиком (ruRU), art/<id>.jpg — арт.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import {cardDb, decodeDeck, download, HS} from './hs-lib.mjs';

const [url, folder] = process.argv.slice(2);
if (!url || !folder) throw new Error('node scripts/fetch-article.mjs <url> <папка ролика>');

// ─── 1. Текст статьи ───
const browser = await puppeteer.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const page = await browser.newPage();
await page.goto(url, {waitUntil: 'networkidle2', timeout: 90000});
const raw = await page.evaluate(() => {
  document.querySelectorAll('noscript').forEach((n) => n.remove()); // иначе в текст попадает HTML ленивых картинок
  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  const cardsIn = (el) =>
    [...(el.querySelectorAll ? el.querySelectorAll('.hs-card-tooltip') : [])]
      .concat(el.classList?.contains('hs-card-tooltip') ? [el] : [])
      .map((s) => ({id: /\/([A-Za-z0-9_]+)\.png/.exec(s.getAttribute('data-image-raw') || '')?.[1], name: clean(s.textContent)}))
      .filter((c) => c.id);
  const first = [...document.querySelectorAll('h2,h3')].find((e) => /^\d+\.\s/.test(e.textContent.trim()));
  const box = first.parentElement;
  const out = {title: clean(document.querySelector('h1').textContent), date: document.querySelector('time')?.getAttribute('datetime'), intro: [], decks: [], outro: [], images: []};
  let cur = null; // текущий раздел-колода
  let loose = null; // абзац, собранный из «голых» строк и ссылок на карты между блоками
  const push = (text, cards) => {
    if (!text) return;
    const para = {text, cards};
    if (cur) cur.paragraphs.push(para);
    else out.intro.push(para);
  };
  const flush = () => {
    if (loose) push(clean(loose.text), loose.cards);
    loose = null;
  };
  for (const n of box.childNodes) {
    const tag = n.nodeType === 1 ? n.tagName : '#text';
    if (tag === '#text' || tag === 'SPAN' || tag === 'A' || tag === 'STRONG' || tag === 'EM' || tag === 'B') {
      loose ??= {text: '', cards: []};
      loose.text += n.textContent;
      if (n.nodeType === 1) loose.cards.push(...cardsIn(n));
      continue;
    }
    flush();
    if (/^H[2-3]$/.test(tag) && /^\d+\.\s/.test(n.textContent.trim())) {
      const m = /^(\d+)\.\s*(.+)$/.exec(clean(n.textContent));
      cur = {rank: Number(m[1]), name: m[2], paragraphs: []};
      out.decks.push(cur);
    } else if (n.classList?.contains('hs-single-deck-container')) {
      cur.cls = clean(n.querySelector('.deck-class')?.textContent ?? '');
      cur.mode = clean(n.querySelector('.deck-mode')?.textContent ?? '');
      const btn = n.querySelector('.copy-code-btn, [data-clipboard-text], [data-code], [data-deckcode]');
      cur.code = btn && (btn.getAttribute('data-clipboard-text') || btn.getAttribute('data-code') || btn.getAttribute('data-deckcode'));
      cur.page = n.querySelector('.deck-title a')?.href;
    } else if (tag === 'H4') {
      for (const img of n.querySelectorAll('img')) out.images.push(img.getAttribute('data-lazy-src') || img.src);
    } else if (tag === 'P' || tag === 'UL' || tag === 'OL') {
      const text = clean(n.textContent);
      if (/^(Наша группа|Также ждем)/.test(text)) break;
      if (cur && cur.rank === 1 && /^Удачных игр/.test(text)) {
        out.outro.push({text, cards: []});
        cur = null;
        continue;
      }
      push(text, cardsIn(n));
    }
  }
  flush();
  return out;
});
await browser.close();

// ─── 2. Колоды: код → 30 карт ───
const all = await cardDb();
const byDbf = new Map(all.map((c) => [c.dbfId, c]));
const byId = new Map(all.map((c) => [c.id, c]));

const need = {tiles: new Set(), render: new Set(), art: new Set()};
for (const d of raw.decks) {
  const {heroes, cards} = decodeDeck(d.code);
  const hero = byDbf.get(heroes[0]);
  d.hero = hero?.id;
  d.heroClass = hero?.cardClass;
  d.list = cards
    .map(([dbf, count]) => {
      const c = byDbf.get(dbf);
      return {id: c.id, name: c.name, cost: c.cost ?? 0, rarity: c.rarity, type: c.type, count};
    })
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ru'));
  d.list.forEach((c) => need.tiles.add(c.id));
  if (d.hero) need.art.add(d.hero);
  for (const p of d.paragraphs) for (const c of p.cards) (need.render.add(c.id), need.art.add(c.id));
}
for (const p of [...raw.intro, ...raw.outro]) for (const c of p.cards) (need.render.add(c.id), need.art.add(c.id));

// ─── 3. Картинки карт (готовые пропускаются) ───
const jobs = [
  ...[...need.tiles].map((id) => [`https://art.hearthstonejson.com/v1/tiles/${id}.png`, `tiles/${id}.png`]),
  ...[...need.render].map((id) => [`https://art.hearthstonejson.com/v1/render/latest/ruRU/512x/${id}.png`, `render/${id}.png`]),
  ...[...need.art].map((id) => [`https://art.hearthstonejson.com/v1/512x/${id}.jpg`, `art/${id}.jpg`]),
].filter(([, f]) => !fs.existsSync(path.join(HS, f)));
const failed = [];
for (let k = 0; k < jobs.length; k += 8) {
  await Promise.all(
    jobs.slice(k, k + 8).map(async ([u, f]) => {
      const res = await download(u, f); // арты сразу без белых полей
      if (res.startsWith('ошибка')) failed.push(`${res} ${u}`);
    }),
  );
}

// ─── 4. Итог ───
const outDir = path.resolve('src/ads', folder);
fs.mkdirSync(outDir, {recursive: true});
const article = {url, ...raw, cardNames: Object.fromEntries([...need.render].map((id) => [id, byId.get(id)?.name]))};
fs.writeFileSync(path.join(outDir, 'article.json'), JSON.stringify(article, null, 1));
console.log(`${raw.title}\nвступление: ${raw.intro.length} абз., колод: ${raw.decks.length}, финал: ${raw.outro.length} абз.`);
for (const d of raw.decks) console.log(`  ${String(d.rank).padStart(2)}. ${d.name} — ${d.cls}, ${d.hero}, карт ${d.list.reduce((s, c) => s + c.count, 0)}, абзацев ${d.paragraphs.length}, упомянуто карт ${d.paragraphs.flatMap((p) => p.cards).length}`);
console.log(`картинок скачано: ${jobs.length - failed.length}${failed.length ? `, ошибки:\n${failed.join('\n')}` : ''}`);
