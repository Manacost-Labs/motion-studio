// Статистика меты для ролика — Koloda Hearthstone API (github.com/Manacost-Labs/api.kolodahearthstone.com):
//   node scripts/meta-stats.mjs yt-<тема> [--min-games 300]
// Для каждой колоды из article.json находит архетип HSReplay (снимок API: Легенда, EU, последние 7 дней) по совпадению
// карт с колодами архетипа и пишет src/studios/manacost-youtube/yt-<тема>/meta.json:
//   винрейт, доля в мете (% всех игр), число игр; лучшие и худшие матч-апы; муллиган (что оставлять); тренд популярности
//   за ~30 дней; источник и время снимка — для подписи «по данным HSReplay · Легенда EU · 7 дней».
// Цифры в ролик — только из статьи или отсюда, с подписью источника. Совпадение карт < 50 % — архетип не найден
// (колода из статьи слишком своя), такие колоды без статистики. Токен KOLODA_API_TOKEN (video/.env) не обязателен:
// данные публичные, с токеном выше лимит запросов.
import fs from 'node:fs';
import path from 'node:path';
import {hasKey, loadEnv} from './lib/env.mjs';
import {VIDEO} from './lib/paths.mjs';
import {videoDir} from './lib/studios.mjs';

process.chdir(VIDEO);
const API = 'https://api.kolodahearthstone.com';
const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--min-games');
if (!id) throw new Error('node scripts/meta-stats.mjs yt-<тема> [--min-games 300]');
const minGames = Number(args.includes('--min-games') ? args[args.indexOf('--min-games') + 1] : 300);
const dir = videoDir(id);
const article = JSON.parse(fs.readFileSync(path.join(dir, 'article.json'), 'utf8'));
const token = hasKey('KOLODA_API_TOKEN') ? loadEnv().KOLODA_API_TOKEN.trim() : undefined;

const get = async (p) => {
  const r = await fetch(API + p, {headers: token ? {Authorization: `Bearer ${token}`} : {}});
  if (!r.ok) throw new Error(`${r.status} ${p}`);
  return /** @type {Promise<any>} */ (r.json());
};

// все архетипы последнего снимка (Легенда, EU)
const all = await get('/api/db/archetypes?limit=200');
const run = all.latest_run;
const deckCache = new Map();
const decksOf = async (aid) => {
  if (!deckCache.has(aid)) deckCache.set(aid, (await get(`/api/db/archetypes/${aid}/decks?include_cards=true&limit=10`)).decks ?? []);
  return deckCache.get(aid);
};
// доля совпавших карт (с учётом копий) между колодой статьи и колодой архетипа
const overlap = (ours, theirs) => {
  const mine = new Map(ours.map((c) => [c.id, c.count ?? 1]));
  const raw = theirs.cards ?? [];
  let hit = 0;
  for (const c of raw) hit += Math.min(mine.get(c.card_id) ?? 0, c.count ?? c.card_count ?? 1);
  const total = ours.reduce((s, c) => s + (c.count ?? 1), 0);
  return total ? hit / total : 0;
};

const out = {
  source: 'HSReplay через api.kolodahearthstone.com',
  rank_range: run?.rank_range,
  region: run?.region,
  period: run?.summary_time_range,
  fetched_at: run?.completed_at,
  decks: {},
};
const rows = [];
for (const d of [...article.decks].sort((a, b) => b.rank - a.rank)) {
  const cands = all.archetypes.filter((a) => a.player_class === d.heroClass);
  let best = {score: 0};
  for (const a of cands) for (const deck of await decksOf(a.archetype_id)) {
    const score = overlap(d.list, deck);
    if (score > best.score) best = {score, a, deck};
  }
  if (best.score < 0.5) {
    rows.push(`${String(d.rank).padStart(2)}. ${d.name.padEnd(30)} — архетип не найден (лучшее совпадение ${Math.round(best.score * 100)} %)`);
    continue;
  }
  const a = best.a;
  const [mu, mul, hist] = await Promise.all([
    get(`/api/db/archetypes/${a.archetype_id}/matchups?limit=100`),
    get(`/api/db/archetypes/${a.archetype_id}/mulligan?limit=12`),
    get(`/api/db/archetypes/${a.archetype_id}/history`),
  ]);
  const vs = (mu.matchups ?? []).filter((m) => m.total_games >= minGames && m.opponent_archetype_id !== a.archetype_id);
  const pick = (m) => ({opponent: m.opponent_name, cls: m.opponent_class, winrate: m.win_rate, games: m.total_games});
  const pop = (hist.history ?? []).filter((h) => h.series_name === 'popularity_over_time');
  const last = pop.at(-1);
  const month = pop.find((h) => new Date(h.point_date) >= new Date(new Date(last?.point_date ?? 0).getTime() - 30 * 864e5));
  out.decks[d.rank] = {
    name: d.name,
    archetype: a.name,
    archetype_id: a.archetype_id,
    url: a.url,
    match: Math.round(best.score * 100) / 100,
    winrate: a.win_rate, // архетип целиком (HSReplay может объединять несколько сборок в один архетип)
    popularity: a.pct_of_total, // % всех игр в Легенде
    games: a.total_games,
    // сама сборка из статьи (самая похожая колода архетипа): её винрейт точнее, если совпадение карт ≥ 90 %
    deck: {winrate: best.deck.win_rate, games: best.deck.total_games, url: best.deck.url, turns: best.deck.avg_num_player_turns},
    reliable: a.total_games >= 1000, // меньше тысячи игр — цифры шумные, в ролик не выносить
    best: [...vs].sort((x, y) => y.win_rate - x.win_rate).slice(0, 3).map(pick),
    worst: [...vs].sort((x, y) => x.win_rate - y.win_rate).slice(0, 3).map(pick),
    mulligan: (mul.mulligan ?? [])
      .sort((x, y) => y.keep_percentage - x.keep_percentage)
      .slice(0, 4)
      .map((c) => ({id: c.card_id, name: c.card_name, keep: c.keep_percentage, winrate: c.opening_hand_winrate})),
    trend: last && month ? {from: month.point_date, to: last.point_date, popularity_from: month.value, popularity_to: last.value} : undefined,
  };
  const s = out.decks[d.rank];
  rows.push(`${String(d.rank).padStart(2)}. ${d.name.padEnd(30)} → ${a.name} (карты ${Math.round(best.score * 100)} %): архетип ${a.win_rate} %, ${a.pct_of_total} % игр, ${a.total_games} игр; сборка ${best.deck.win_rate} % в ${best.deck.total_games} играх${s.reliable ? '' : ' — МАЛО ИГР'}`);
  if (s.worst.length) rows.push(`      хуже всего против: ${s.worst.map((m) => `${m.opponent} ${m.winrate} %`).join(', ')}`);
}
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(out, null, 1));
console.log(`снимок: ${out.source} · ${out.rank_range} ${out.region} · ${out.period} · ${out.fetched_at}`);
console.log(rows.join('\n'));
console.log(`→ ${path.relative(process.cwd(), path.join(dir, 'meta.json'))}`);
