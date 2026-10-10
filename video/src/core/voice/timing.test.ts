// Хронометраж под голос: привязки к фразе (anchorFrame, timeAt) и субтитры (buildSubs) — по оценке текста и по записи.
// Образец записи — в форме public/vo/<ролик>/<сегмент>.json (scripts/vo-align.mjs): text и время начала и конца каждого символа
import {describe, expect, it} from 'vitest';
import {anchorFrame, buildSubs, CPS, estimateVo, spreadFrame, splitSubs, stripTags, timeAt, twoLines, type VoSpan, type VoTimes} from './timing';
import {BASE_FPS} from '../time/fps';

// Запись: символ — 0,06 с, после конца предложения — пауза 0,4 с (как у диктора)
const record = (text: string): {text: string; start: number[]; end: number[]} => {
  const start: number[] = [];
  const end: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    start.push(Math.round(t * 1000) / 1000);
    t += 0.06;
    end.push(Math.round(t * 1000) / 1000);
    if (/[.!?…]/.test(text[i]) && text[i + 1] === ' ') t += 0.4;
  }
  return {text, start, end};
};

const VO = '[pause] Первое место — Дракон Воин. Игрокам понадобилось время, чтобы понять: дешёвые драконы сильнее дорогих. Коротко. А теперь длинная фраза без точек, которая обязательно не поместится в один кусок субтитров и потому будет разбита на равные части по смыслу и у знаков препинания, как и положено.';
const SHOWN = stripTags(VO);
const REC = record(SHOWN);
const TIMES: VoTimes = {start: REC.start, end: REC.end};

describe('stripTags, estimateVo', () => {
  it('аудиотеги и пробел за ними не попадают на экран', () => {
    expect(stripTags('[pause] Раз [warmly]два.')).toBe('Раз два.');
    expect(SHOWN.startsWith('Первое место')).toBe(true);
  });
  it('оценка длины — по знакам на экране и CPS', () => {
    expect(estimateVo('[pause] абв')).toBe(Math.ceil((3 / CPS) * BASE_FPS));
    expect(estimateVo('')).toBe(0);
  });
});

describe('anchorFrame', () => {
  const span: VoSpan = {id: 'deck-01', voFrom: 10, voDur: 600};
  it('без записи — по доле текста до фразы (теги не считаются, регистр не важен)', () => {
    const i = SHOWN.indexOf('Дракон');
    expect(anchorFrame(span, VO, 'дракон воин')).toBe(10 + Math.round((i / SHOWN.length) * 600));
  });
  it('с записью — по времени первого символа фразы', () => {
    const i = SHOWN.indexOf('дешёвые');
    expect(anchorFrame({...span, times: TIMES}, VO, 'Дешёвые')).toBe(10 + Math.round(REC.start[i] * BASE_FPS));
  });
  it('фразы нет в тексте — ошибка с id сегмента', () => {
    expect(() => anchorFrame(span, VO, 'Жрец')).toThrow(/Жрец.*deck-01/);
  });
});

describe('timeAt', () => {
  const span: VoSpan = {id: 's', voFrom: 10, voDur: 300};
  it('без фразы — равномерно по тексту (spreadFrame)', () => {
    const at = timeAt(span, VO);
    expect(at(undefined, 0, 4)).toBe(spreadFrame(span, 0, 4));
    expect(at(undefined, 3, 4)).toBe(10 + Math.round(300 * (0.1 + 0.75 * 0.75)));
    expect(at(undefined, 1, 4)).toBeGreaterThan(at(undefined, 0, 4));
  });
  it('min — не раньше этого кадра', () => {
    expect(timeAt(span, VO, 500)('Первое')).toBe(500);
    expect(timeAt(span, VO, 0)('Первое')).toBe(10);
  });
  it('n = 0 не делит на ноль', () => {
    expect(Number.isFinite(spreadFrame(span, 0, 0))).toBe(true);
  });
});

describe('субтитры', () => {
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  const check = (subs: ReturnType<typeof buildSubs>) => {
    for (const s of subs) {
      const lines = s.text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(flat(s.text).length).toBeLessThanOrEqual(84); // кусок — до двух строк по ~42 знака
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(50);
      expect(s.to).toBeGreaterThan(s.from);
    }
    for (let i = 1; i < subs.length; i++) expect(subs[i].from).toBeGreaterThanOrEqual(subs[i - 1].to); // без наложений
    // ни одно слово не потеряно и порядок тот же
    expect(subs.map((s) => flat(s.text)).join(' ')).toBe(flat(SHOWN));
  };

  it('без записи: куски в пределах голоса, последний кончается с голосом', () => {
    const subs = buildSubs(VO, 10, 900);
    expect(subs.length).toBeGreaterThan(3);
    check(subs);
    expect(subs[0].from).toBe(10);
    expect(subs.at(-1)!.to).toBe(10 + 900);
  });

  it('с записью: начало куска — время его первого символа, конец последнего — +12 кадров после голоса', () => {
    const subs = buildSubs(VO, 10, Math.ceil(REC.end.at(-1)! * BASE_FPS), TIMES);
    check(subs);
    expect(subs[0].from).toBe(10);
    expect(subs.at(-1)!.to).toBe(10 + Math.round(REC.end.at(-1)! * BASE_FPS) + 12);
    const second = SHOWN.indexOf(flat(subs[1].text));
    expect(subs[1].from).toBe(10 + Math.round(REC.start[second] * BASE_FPS));
  });

  it('короткий кусок склеивается с соседом', () => {
    expect(splitSubs('Коротко. Это вторая фраза, она подлиннее первой.')).toEqual(['Коротко. Это вторая фраза, она подлиннее первой.']);
  });

  it('twoLines: короткое — одной строкой, длинное — двумя без висящего предлога', () => {
    expect(twoLines('Первое место — Дракон Воин.')).toBe('Первое место — Дракон Воин.');
    const two = twoLines('Игрокам понадобилось время, чтобы понять: дешёвые драконы сильнее');
    const [a, b] = two.split('\n');
    expect(b).toBeDefined();
    expect(a.split(' ').at(-1)!.length > 2 || /[,;:]$/.test(a)).toBe(true);
  });
});
