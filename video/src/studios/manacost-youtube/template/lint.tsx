// Проверка раскладки кадра в браузере (scripts/yt-lint.mjs): реальные границы надписей после всех анимаций.
// Включается только при рендере проверки (REMOTION_LINT) — в ролик не попадает. Ищет:
//   • текст за краем кадра (видимая часть, с учётом масок overflow);
//   • текст на тексте из разных блоков;
//   • текст на «запретной зоне» — элементах с data-qa-clear (постер колоды, карты веера): надпись их перекрывает.
// Украшения, которым перекрывать можно по замыслу (сургучная печать на углу постера), помечены data-qa-ok — их текст не проверяется.
// Результат — в консоль строкой «YTLINT {…}», её собирает скрипт через onBrowserLog
import React, {useEffect} from 'react';
import {continueRender, delayRender, useCurrentFrame} from 'remotion';

type Box = {left: number; top: number; right: number; bottom: number};
export type LintIssue = {kind: 'edge' | 'overlap' | 'clear'; text: string; other?: string; box: Box};

const W = 1920;
const H = 1080;
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

export const lintDom = (): LintIssue[] => {
  const items: {text: string; box: Box; block: Element; el: Element}[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').trim();
    const el = n.parentElement;
    if (!text || !el || opacityOf(el) < 0.15 || el.closest('[data-qa-ok]')) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const box = clipOf(el, r);
    if (area(box) < area(r) * 0.4) continue; // в основном спрятан маской — так задумано (вылет из-под маски)
    items.push({text, box, block: blockOf(el), el});
  }
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

// Зонд: после отрисовки кадра (и загрузки шрифтов) меряет раскладку и пишет её в консоль
export const LintProbe: React.FC = () => {
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender('проверка раскладки');
    (document.fonts?.ready ?? Promise.resolve()).then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          console.debug(`YTLINT ${JSON.stringify({frame, issues: lintDom()})}`);
          continueRender(handle);
        }),
      ),
    );
  }, [frame]);
  return null;
};
