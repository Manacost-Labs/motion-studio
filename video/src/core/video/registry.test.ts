// Реестр сцен: канал собирает byKind, повтор вида — ошибка (иначе молча победила бы последняя сцена), чужой вид — ошибка
import {describe, expect, it} from 'vitest';
import {defineChannel, defineScene, fields, sceneOf} from './registry';

const Noop = () => null;
type A = {id: string; kind: 'a'; vo: string};
type B = {id: string; kind: 'b'; vo: string};
const a = defineScene<A>({kind: 'a', Component: Noop, min: 60});
const b = defineScene<B>({kind: 'b', Component: Noop});
const base = {look: {} as any, brand: 'x', game: null, context: () => ({})};

describe('defineScene', () => {
  it('возвращает описание как есть', () => {
    const def = {kind: 'a' as const, Component: Noop, lead: 5};
    expect(defineScene<A>(def)).toBe(def);
  });
});

describe('defineChannel', () => {
  it('byKind — сцена по виду, остальное канала сохраняется', () => {
    const ch = defineChannel({...base, fields: fields<{title: string}>(), scenes: [a, b]});
    expect(ch.byKind).toEqual({a, b});
    expect(ch.scenes).toEqual([a, b]);
    expect(ch.brand).toBe('x');
  });
  it('один вид дважды — ошибка с именем вида', () => {
    const a2 = defineScene<A>({kind: 'a', Component: Noop});
    expect(() => defineChannel({...base, fields: {}, scenes: [a, b, a2]})).toThrow(/«a»/);
  });
});

describe('sceneOf', () => {
  const ch = defineChannel({...base, fields: {}, scenes: [a, b]});
  it('правила сцены по виду', () => {
    expect(sceneOf(ch, 'a')).toBe(a);
  });
  it('вид не из канала — ошибка с подсказкой', () => {
    expect(() => sceneOf(ch, 'deck')).toThrow(/deck.*channel\.ts/);
  });
});

describe('fields', () => {
  it('только тип: в рантайме пустой объект', () => {
    expect(fields<{title: string}>()).toEqual({});
  });
});
