// Проверка раскладки кадра в браузере (scripts/yt-lint.mjs): реальные границы надписей после всех анимаций.
// Включается только при рендере проверки (REMOTION_LINT) — в ролик не попадает. Ищет:
//   • текст за краем кадра (видимая часть, с учётом масок overflow);
//   • текст на тексте из разных блоков;
//   • текст на «запретной зоне» — элементах с data-qa-clear (постер колоды, карты веера): надпись их перекрывает.
// Украшения, которым перекрывать можно по замыслу (сургучная печать на углу постера), помечены data-qa-ok — их текст не проверяется.
// И читаемость на телефоне (readDom, только замеры — решает yt-lint, уровень ⚠): кегль смыслового текста и контраст с фоном.
// Результат — в консоль строкой «YTLINT {…}», её собирает скрипт через onBrowserLog.
// Лёгкий режим REMOTION_LINT=seen (seenDom) — только какие смысловые надписи видны в кадре: yt-lint проходит ролик частыми
// кадрами без снимков и считает, сколько каждая надпись на экране (время чтения, ⚠); строка «YTSEEN {…}»
import React, {useEffect} from 'react';
import {continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';

type Box = {left: number; top: number; right: number; bottom: number};
export type LintIssue = {kind: 'edge' | 'overlap' | 'clear'; text: string; other?: string; box: Box};

const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
const cross = (a: Box, b: Box): Box => ({left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)});

// видимость: произведение opacity предков, visibility/display
const opacityOf = (el: Element | null) => {
  let o = 1;
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    o *= Number(cs.opacity);
  }
  return o;
};
// видимая часть прямоугольника: обрезка предками с overflow ≠ visible
const clipOf = (el: Element, b: Box) => {
  let r = b;
  for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') r = cross(r, e.getBoundingClientRect());
  }
  return r;
};
// блок надписи — ближайший предок с position absolute/fixed (наложения внутри одного блока не считаем)
const blockOf = (el: Element) => {
  for (let e: Element | null = el; e; e = e.parentElement) if (['absolute', 'fixed'].includes(getComputedStyle(e).position)) return e;
  return document.body;
};

// видимые надписи кадра: текстовый узел → текст, видимая часть, блок, элемент, видимость (opacity с предками)
type TextItem = {text: string; box: Box; block: Element; el: Element; opacity: number};
const textItems = (): TextItem[] => {
  const items: TextItem[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('[data-qa-ok]')) continue;
    const opacity = opacityOf(el);
    if (opacity < 0.15) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const box = clipOf(el, r);
    if (area(box) < area(r) * 0.4) continue; // в основном спрятан маской — так задумано (вылет из-под маски)
    items.push({text, box, block: blockOf(el), el, opacity});
  }
  return items;
};

// W, H — размер кадра композиции (LintProbe берёт его из useVideoConfig)
export const lintDom = (W = 1920, H = 1080): LintIssue[] => {
  const items = textItems();
  const issues: LintIssue[] = [];
  for (const it of items) if (it.box.left < -4 || it.box.top < -4 || it.box.right > W + 4 || it.box.bottom > H + 4) issues.push({kind: 'edge', text: it.text, box: it.box});
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.block === b.block || a.block.contains(b.block) || b.block.contains(a.block)) continue;
      if (area(cross(a.box, b.box)) > 0.25 * Math.min(area(a.box), area(b.box))) issues.push({kind: 'overlap', text: a.text, other: b.text, box: a.box});
    }
  const zones = [...document.querySelectorAll('[data-qa-clear]')].filter((z) => opacityOf(z) >= 0.2);
  for (const z of zones) {
    const zb = clipOf(z, z.getBoundingClientRect());
    for (const it of items) if (!z.contains(it.el) && area(cross(it.box, zb)) > 0.25 * area(it.box)) issues.push({kind: 'clear', text: it.text, other: z.getAttribute('data-qa-clear') ?? '', box: it.box});
  }
  return issues;
};

// ─── Читаемость на телефоне: замеры смыслового текста (есть буква или цифра) ───
// size — кегль в пикселях кадра 1080p: font-size × масштаб transform/scale предков × масштаб viewBox SVG; null — элемент
// или предок помечен data-qa-small-ok (мелкий по замыслу: сноска, номер). ratio — контраст WCAG 2.x цвета текста (с opacity
// предков) с однотонным фоном под ним; null — фон не однотонный или неизвестен (why). Фон — слои под надписью в точке её
// центра сверху вниз (elementsFromPoint: сам элемент, его предки и соседи, нарисованные ниже) до первого непрозрачного цвета
// фона — ближайший непрозрачный слой; полупрозрачные цвета над ним накладываются. Картинка, видео, canvas, SVG или градиент
// под надписью — пропуск. halo — у текста тень или обводка (контраст с фоном она поднимает, формула её не видит).
// comp — номер в chains: имена React-компонентов от надписи наружу (yt-lint находит по ним файл; одинаковые цепочки — один
// раз, чтобы строка зонда была короче). Пороги — VIDEO_LIMITS (core/qa/limits.ts), решение и уровень (⚠) — в
// scripts/yt-lint.mjs: зонд только меряет
export type ReadSample = {text: string; size: number | null; ratio: number | null; why?: string; fg?: string; bg?: string; halo?: boolean; comp: number};
export type ReadReport = {chains: string[][]; samples: ReadSample[]};

type Rgba = {r: number; g: number; b: number; a: number};
const rgba = (s: string): Rgba | null => {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s.trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return {r: +m[1], g: +m[2], b: +m[3], a};
};
const over = (top: Rgba, a: number, under: Rgba): Rgba => ({r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a), a: 1});
const hex = (c: Rgba) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lum = (c: Rgba) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
};
const contrast = (a: Rgba, b: Rgba) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// масштаб элемента на экране: transform и scale предков (√|det| матрицы — верно и при повороте) и viewBox внешних SVG
const scaleOf = (el: Element) => {
  let s = 1;
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const m = /^matrix(3d)?\((.+)\)$/.exec(cs.transform);
    if (m) {
      const v = m[2].split(',').map(Number);
      const [a, b, c, d] = m[1] ? [v[0], v[1], v[4], v[5]] : [v[0], v[1], v[2], v[3]];
      s *= Math.sqrt(Math.abs(a * d - b * c));
    }
    if (cs.scale && cs.scale !== 'none') {
      const [x, y = x] = cs.scale.split(/\s+/).map(Number);
      s *= Math.sqrt(Math.abs(x * y));
    }
  }
  for (let svg = el instanceof SVGElement ? el.ownerSVGElement : null; svg; svg = svg.ownerSVGElement) {
    const vb = svg.viewBox?.baseVal;
    if (vb && vb.width > 0 && vb.height > 0 && svg.clientWidth > 0) s *= Math.min(svg.clientWidth / vb.width, svg.clientHeight / vb.height);
  }
  return s;
};

// однотонный фон под точкой (x, y) надписи el: цвет или причина пропуска
const IMAGE_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME']);
const backgroundAt = (el: Element, x: number, y: number): Rgba | string => {
  const stack = document.elementsFromPoint(x, y);
  let i = stack.indexOf(el);
  if (i < 0) i = stack.findIndex((e) => e.contains(el));
  if (i < 0) return 'надпись не найдена в точке';
  const layers: {c: Rgba; a: number}[] = [];
  for (const e of stack.slice(i)) {
    const o = opacityOf(e);
    if (o < 0.05) continue;
    const mine = e === el || e.contains(el); // предок надписи: смотрим только его фон
    if (!mine && (IMAGE_TAGS.has(e.tagName) || e instanceof SVGElement)) return `фон — ${e instanceof SVGElement ? 'SVG' : e.tagName.toLowerCase()}`;
    const cs = getComputedStyle(e);
    if (cs.backgroundImage !== 'none') return (cs.backgroundImage.includes('url(') ? 'фон — картинка (background-image)' : 'фон — градиент');
    const c = rgba(cs.backgroundColor);
    if (!c) return `цвет фона не разобран (${cs.backgroundColor})`;
    if (c.a * o <= 0.01) continue;
    layers.push({c, a: c.a * o});
    if (c.a * o >= 0.99) return layers.reduceRight<Rgba>((under, l) => over(l.c, l.a, under), {...c, a: 1});
  }
  return 'непрозрачного фона нет';
};

const componentsOf = (el: Element): string[] => {
  const names: string[] = [];
  for (let e: Element | null = el; e && !names.length; e = e.parentElement) {
    const key = Object.keys(e).find((k) => k.startsWith('__reactFiber$'));
    if (!key) continue;
    for (let f = (e as any)[key]; f && names.length < 10; f = f.return) {
      const t = f.type;
      const name = typeof t === 'function' ? t.displayName || t.name : t && typeof t === 'object' ? t.displayName || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name : '';
      if (name && names.at(-1) !== name) names.push(name);
    }
  }
  return names;
};

export const readDom = (W = 1920, H = 1080): ReadReport => {
  const k = 1080 / H;
  const out: ReadReport = {chains: [], samples: []};
  const chainIndex = new Map<string, number>();
  const chainOf = (el: Element) => {
    const names = componentsOf(el);
    const key = names.join('<');
    if (!chainIndex.has(key)) chainIndex.set(key, out.chains.push(names) - 1);
    return chainIndex.get(key) as number;
  };
  // заливку фоном и смешивание формула не посчитает — такой текст по контрасту не меряем
  const blended = (el: Element) => {
    for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.mixBlendMode !== 'normal') return 'смешивание (mix-blend-mode)';
      if (cs.backgroundClip === 'text' || cs.getPropertyValue('-webkit-background-clip') === 'text') return 'заливка текста фоном';
    }
    return '';
  };
  // hit-test elementsFromPoint пропускает pointer-events: none — на время замера включаем всем (на картинку не влияет)
  const unlock = document.createElement('style');
  unlock.textContent = '* { pointer-events: auto !important; }';
  document.head.appendChild(unlock);
  try {
    for (const it of textItems()) {
      if (!/[\p{L}\p{N}]/u.test(it.text)) continue; // «·», «—», «★» — не смысловой текст
      const {el, box} = it;
      if (box.right < 0 || box.bottom < 0 || box.left > W || box.top > H) continue;
      const cs = getComputedStyle(el);
      const size = el.closest('[data-qa-small-ok]') ? null : Math.round(parseFloat(cs.fontSize) * scaleOf(el) * k * 10) / 10;
      const halo = cs.textShadow !== 'none' || parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) > 0;
      const sample: ReadSample = {text: it.text.slice(0, 80), size, ratio: null, halo, comp: chainOf(el)};
      const fill = rgba(cs.getPropertyValue('-webkit-text-fill-color'));
      const fg = fill && fill.a > 0 ? fill : rgba(cs.color);
      const why = blended(el) || (!fg ? `цвет текста не разобран (${cs.color})` : '');
      const bg = why ? why : backgroundAt(el, Math.min(W - 1, Math.max(0, (box.left + box.right) / 2)), Math.min(H - 1, Math.max(0, (box.top + box.bottom) / 2)));
      if (typeof bg === 'string') sample.why = bg;
      else if (fg) {
        const seen = over(fg, fg.a * opacityOf(el), bg);
        sample.ratio = Math.round(contrast(seen, bg) * 100) / 100;
        sample.fg = hex(seen);
        sample.bg = hex(bg);
      }
      out.samples.push(sample);
    }
  } finally {
    unlock.remove();
  }
  return out;
};

// ─── Время чтения: какие смысловые надписи видны в кадре (режим REMOTION_LINT=seen) ───
// seen — [текст целиком, opacity с предками (от 0,15, до сотых), 1 — мелкий по замыслу (data-qa-small-ok), номер цепочки
// компонентов в chains]. Без снимка и замеров фона — кадр дешёвый: yt-lint проходит ролик с шагом в доли секунды и сам решает,
// что считать «на экране», что — субтитры, и сколько надписи нужно на прочтение (пороги — VIDEO_LIMITS)
export type SeenReport = {chains: string[][]; seen: [string, number, 0 | 1, number][]};
export const seenDom = (W = 1920, H = 1080): SeenReport => {
  const out: SeenReport = {chains: [], seen: []};
  const chainIndex = new Map<string, number>();
  for (const it of textItems()) {
    if (!/[\p{L}\p{N}]/u.test(it.text)) continue; // «·», «—», «★» — не смысловой текст
    const {box} = it;
    if (box.right <= 0 || box.bottom <= 0 || box.left >= W || box.top >= H) continue;
    const names = componentsOf(it.el);
    const key = names.join('<');
    if (!chainIndex.has(key)) chainIndex.set(key, out.chains.push(names) - 1);
    out.seen.push([it.text, Math.round(it.opacity * 100) / 100, it.el.closest('[data-qa-small-ok]') ? 1 : 0, chainIndex.get(key) as number]);
  }
  return out;
};

// Зонд: после отрисовки кадра (и загрузки шрифтов) меряет раскладку и читаемость и пишет их в консоль;
// в режиме seen — только видимые надписи
export const LintProbe: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  useEffect(() => {
    const handle = delayRender('проверка раскладки');
    const seen = process.env.REMOTION_LINT === 'seen';
    (document.fonts?.ready ?? Promise.resolve()).then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          console.debug(seen ? `YTSEEN ${JSON.stringify({frame, ...seenDom(width, height)})}` : `YTLINT ${JSON.stringify({frame, issues: lintDom(width, height), read: readDom(width, height)})}`);
          continueRender(handle);
        }),
      ),
    );
  }, [frame, width, height]);
  return null;
};
