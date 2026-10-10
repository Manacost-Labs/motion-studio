// Реестр студий src/studios/studios.json (его читают скрипты, render.ps1 и хуки): ключи, папки, порты и префиксы не
// повторяются, папки студии, игры, стиля и бренда есть, у каждой студии — команда studio:<key> в package.json с её портом
import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {STUDIOS, studio, studioOf} from './studios.mjs';
import {VIDEO} from './paths.mjs';

const src = (...p: string[]) => path.join(VIDEO, 'src', ...p);
const dupes = (xs: unknown[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
const pkg = JSON.parse(fs.readFileSync(path.join(VIDEO, 'package.json'), 'utf8'));

describe('studios.json', () => {
  it('не пуст, у каждой строки все поля', () => {
    expect(STUDIOS.length).toBeGreaterThan(0);
    for (const s of STUDIOS) {
      for (const k of ['key', 'dir', 'kind', 'title', 'game', 'brand', 'look', 'idPrefix', 'port', 'freeze']) expect(s, `${s.key}: нет поля ${k}`).toHaveProperty(k);
      expect(['ads', 'features', 'youtube']).toContain(s.kind);
      expect(['check-ads', 'golden']).toContain(s.freeze);
    }
  });
  it('ключи, папки, порты и префиксы id не повторяются', () => {
    expect(dupes(STUDIOS.map((s) => s.key))).toEqual([]);
    expect(dupes(STUDIOS.map((s) => s.dir))).toEqual([]);
    expect(dupes(STUDIOS.map((s) => s.port))).toEqual([]);
    expect(dupes(STUDIOS.map((s) => s.idPrefix).filter(Boolean))).toEqual([]);
  });
  it('ключи существующих студий не меняются', () => {
    expect(['ads', 'features', 'youtube', 'lol'].map((k) => [studio(k).dir, studio(k).port])).toEqual([
      ['hp-ads', 3000],
      ['hp-features', 3001],
      ['manacost-youtube', 3002],
      ['lol-youtube', 3003],
    ]);
  });
  it('папки студии (с index.ts), игры, стиля и бренда существуют', () => {
    for (const s of STUDIOS) {
      expect(fs.existsSync(src('studios', s.dir, 'index.ts')), `src/studios/${s.dir}/index.ts`).toBe(true);
      if (s.game) expect(fs.existsSync(src('games', s.game)), `src/games/${s.game}`).toBe(true);
      // бренд и стиль рекламы — src/hearthpulse (вне слоёв)
      for (const [layer, name] of [['brands', s.brand], ['looks', s.look]]) {
        const dir = name === 'hearthpulse' ? src('hearthpulse') : src(layer, name);
        expect(fs.existsSync(dir), `${layer}/${name}`).toBe(true);
      }
    }
  });
  it('YouTube-студии — с префиксом id и эталонами golden', () => {
    for (const s of STUDIOS.filter((x) => x.kind === 'youtube')) {
      expect(s.idPrefix, s.key).toMatch(/^[a-z]+-$/);
      expect(s.freeze).toBe('golden');
      expect(studioOf(`${s.idPrefix}test-id`).key).toBe(s.key);
    }
  });
  it('package.json: studio:<key> открывает index.ts студии на её порту', () => {
    for (const s of STUDIOS) {
      const cmd: string | undefined = pkg.scripts[`studio:${s.key}`];
      expect(cmd, `нет скрипта studio:${s.key}`).toBeDefined();
      expect(cmd).toContain(`src/studios/${s.dir}/index.ts`);
      expect(Number(cmd!.match(/--port (\d+)/)?.[1] ?? 3000)).toBe(s.port);
    }
  });
});
