// Снимает страницы hearthpulse.net в 2x из-под аккаунта владельца (закрытые разделы открыты).
// Открывает окно Chrome с временным профилем, ждёт входа, снимает страницы целиком
// и удаляет профиль вместе с сессией. Результат: capture/a-<имя>.png + .json с координатами блоков.
//   node scripts/capture-auth.mjs              — все страницы
//   node scripts/capture-auth.mjs a-archetypes — только выбранные
import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = path.resolve('capture');
fs.mkdirSync(OUT, {recursive: true});
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-capture-'));

// [имя, адрес, максимум высоты в CSS px, действие перед съёмкой]
const PAGES = [
  ['a-home', '/', 2600],
  ['a-meta', '/standard/meta', 5200],
  ['a-archetypes', '/standard/archetypes', 7600],
  ['a-matchups', '/standard/matchups', 4000],
  ['a-vsgold', '/standard/vicious-gold', 4000],
  ['a-fundecks', '/standard/fun-decks', 4000],
  ['a-card-aya', '/standard/cards/standard/JAIL_504', 2400],
  ['a-cards-hover', '/standard/cards', 1600, 'hoverAya'],
  ['a-cards-nohover', '/standard/cards', 1600, 'searchAya'],
  ['a-bg-minion', '/library/minions/%D0%B1%D0%B0%D1%8E%D0%B1%D0%BE%D1%82-98582/', 4000],
  ['a-bg-tier-minions', '/battlegrounds/tier-list', 4000, 'tab:Существа'],
  ['a-classes', '/classes', 3600],
  ['a-tierlist', '/tierlist', 6000],
  ['a-legendaries', '/legendaries', 5000],
  ['a-heroes', '/heroes', 7000],
  ['a-library', '/library', 5000],
  ['a-bg-tierlist', '/battlegrounds/tier-list', 5000, 'tab:Стратегии'],
  ['a-articles', '/articles', 4000],
  ['a-cosmetics', '/cosmetics', 4000],
];
const only = process.argv.slice(2);
const LOGIN_TIMEOUT_MS = 25 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


// Обычное окно Chrome (без флагов автоматизации — иначе страницы входа могут его блокировать).
// Скрипт подключается к нему через порт отладки.
// Если окно уже открыто (например, после перезапуска скрипта) — подключаемся к нему, вход не повторяем.
const PORT = 9333;
const running = await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true).catch(() => false);
const chrome = running ? null : spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1400,950',
    // Не усыплять вкладки, если окно свёрнуто или перекрыто — иначе съёмка зависает
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    'https://hearthpulse.net/?login',
  ],
  {detached: false, stdio: 'ignore'},
);
let wsEndpoint;
for (let i = 0; i < 60 && !wsEndpoint; i++) {
  await sleep(500);
  wsEndpoint = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    .then((r) => r.json())
    .then((j) => j.webSocketDebuggerUrl)
    .catch(() => undefined);
}
if (!wsEndpoint) throw new Error('Chrome не запустился');
const browser = await puppeteer.connect({browserWSEndpoint: wsEndpoint, defaultViewport: null});

const actions = {
  // Найти Айю в галерее карт (тот же кадр без наведения — для анимации появления подсказки)
  async searchAya(page) {
    const input = await page.$('input[placeholder*="Название"]');
    if (input) {
      await input.type('Айя', {delay: 60});
      await sleep(2500);
    }
    await page.mouse.move(5, 5);
    await sleep(600);
  },
  // Найти Айю в галерее карт и навести курсор, чтобы появилась всплывающая статистика
  async hoverAya(page) {
    await actions.searchAya(page);
    const card = await page.$('.constructed-cards__gallery-card');
    if (card) {
      await card.hover();
      await sleep(1200);
    }
  },
  async tab(page, label) {
    await page.evaluate((l) => {
      const el = [...document.querySelectorAll('button, a, [role="tab"], div')].find(
        (e) => e.children.length < 4 && e.innerText && e.innerText.trim().startsWith(l),
      );
      el?.click();
    }, label);
    await sleep(2000);
  },
};

try {
  console.log('Жду входа в аккаунт…');

  const t0 = Date.now();
  let loggedIn = false;
  while (!loggedIn && Date.now() - t0 < LOGIN_TIMEOUT_MS) {
    await sleep(3000);
    for (const p of await browser.pages()) {
      if (!p.url().startsWith('https://hearthpulse.net')) continue;
      // После входа ссылка /?login остаётся, но превращается в «Профиль <имя>»
      const ok = await p
        .evaluate(() => [...document.querySelectorAll('a[href="/?login"]')].some((a) => /Профиль/.test(a.innerText)))
        .catch(() => false);
      if (ok) loggedIn = true;
    }
  }
  if (!loggedIn) throw new Error('Вход не выполнен за 25 минут');
  console.log('Вход выполнен, снимаю страницы');

  for (const [name, url, maxH, action] of PAGES) {
    if (only.length && !only.includes(name)) continue;
    // Ошибка на одной странице не обрывает съёмку остальных
    try {
    const page = await browser.newPage();
    await page.bringToFront();
    // Для кадров галереи окно сразу нужной высоты: прокрутка сбросила бы всплывающую статистику
    const still = action === 'hoverAya' || action === 'searchAya';
    await page.setViewport({width: 1440, height: still ? maxH : 900, deviceScaleFactor: 2});
    await page.goto('https://hearthpulse.net' + url, {waitUntil: 'networkidle2', timeout: 90000});
    await sleep(1500);
    if (action) {
      const [kind, arg] = action.split(':');
      await actions[kind](page, arg);
    }
    if (!still) {
      // Прокрутка вниз, чтобы подгрузились ленивые картинки
      await page.evaluate(async (h) => {
        for (let y = 0; y < h; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      }, maxH);
      await sleep(2500);
    }

    const blocks = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const out = [];
      const walk = (el, d) => {
        if (d > 6) return;
        for (const c of el.children) {
          const r = c.getBoundingClientRect();
          if (r.height > 40 && r.width > 150) {
            out.push({
              d, tag: c.tagName, cls: (c.className || '').toString().slice(0, 80),
              x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY),
              w: Math.round(r.width), h: Math.round(r.height),
              // у SVG (графики) нет innerText
              txt: (c.innerText ?? c.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80),
            });
            walk(c, d + 1);
          }
        }
      };
      walk(main, 0);
      return {total: document.documentElement.scrollHeight, blocks: out};
    });
    fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(blocks, null, 1));
    const h = Math.min(blocks.total, maxH);
    await page.screenshot({path: path.join(OUT, name + '.png'), clip: {x: 0, y: 0, width: 1440, height: h}, captureBeyondViewport: !still});
    console.log(`${name}: page ${blocks.total}px, shot ${h}px`);
    await page.close();
    } catch (e) {
      console.log(`${name}: ОШИБКА ${e.message}`);
    }
  }
} finally {
  await browser.close().catch(() => chrome?.kill());
  await sleep(1500);
  // Удаляем все временные профили съёмки вместе с сессией
  for (const d of fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('hp-capture-'))) {
    fs.rmSync(path.join(os.tmpdir(), d), {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
  }
  console.log('Окно закрыто, временный профиль удалён');
}
