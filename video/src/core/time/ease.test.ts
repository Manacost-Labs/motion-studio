// Кривые и рампы движения: концы, зажим за краями, монотонность (на них стоят все входы и выходы сцен)
import {describe, expect, it} from 'vitest';
import {clamp, EASE, EASE_IN, EASE_IN_OUT, EASE_OUT, ramp} from './ease';

const curves = {out: EASE_OUT, in: EASE_IN, inOut: EASE_IN_OUT};
const steps = (n: number) => Array.from({length: n + 1}, (_, i) => i / n);

describe('кривые EASE', () => {
  it('EASE — те же три кривые', () => {
    expect(EASE).toEqual(curves);
  });
  for (const [name, f] of Object.entries(curves)) {
    it(`${name}: 0 → 0, 1 → 1, не убывает`, () => {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
      const ys = steps(200).map(f);
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
    });
  }
  it('out быстро стартует, in — медленно', () => {
    expect(EASE_OUT(0.25)).toBeGreaterThan(0.5);
    expect(EASE_IN(0.25)).toBeLessThan(0.1);
  });
});

describe('clamp', () => {
  it('зажимает interpolate с обеих сторон', () => {
    expect(clamp).toEqual({extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  });
});

describe('ramp(f, a, b)', () => {
  it('0 на a и раньше, 1 на b и позже', () => {
    expect(ramp(10, 10, 40)).toBe(0);
    expect(ramp(-100, 10, 40)).toBe(0);
    expect(ramp(40, 10, 40)).toBe(1);
    expect(ramp(1000, 10, 40)).toBe(1);
  });
  it('внутри — 0…1 и не убывает для любой кривой', () => {
    for (const f of Object.values(curves)) {
      let prev = 0;
      for (let fr = 10; fr <= 40; fr += 0.5) {
        const v = ramp(fr, 10, 40, f);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        prev = v;
      }
    }
  });
  it('по умолчанию — EASE_OUT', () => {
    expect(ramp(20, 10, 40)).toBeCloseTo(EASE_OUT(1 / 3), 9);
  });
});
