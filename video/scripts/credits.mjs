// Остаток кредитов перед любой тратой: node scripts/credits.mjs [--need 1200]
//   ElevenLabs — по ключу ELEVENLABS_API_KEY из video/.env (озвучка: ≈ 1 кредит за знак; коннектор тратит с того же счёта);
//   Higgsfield — через CLI (higgsfield account status);
//   OpenRouter — по ключу OPENROUTER_API_KEY бесплатными GET /api/v1/credits и /api/v1/key (судья judge.mjs --backend openrouter);
//   печатаются только суммы, ключ и его подпись — никогда.
// --need N — хватит ли N кредитов ElevenLabs на запланированную запись (сумма знаков vo: vo-align.mjs --prepare печатает).
import {spawnSync} from 'node:child_process';
import {hasKey, loadEnv} from './lib/env.mjs';
import {account} from './lib/openrouter.mjs';
import {VIDEO} from './lib/paths.mjs';

process.chdir(VIDEO);
const args = process.argv.slice(2);
const need = args.includes('--need') ? Number(args[args.indexOf('--need') + 1]) : 0;
const key = hasKey('ELEVENLABS_API_KEY') ? loadEnv().ELEVENLABS_API_KEY.trim() : undefined;

if (key) {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', {headers: {'xi-api-key': key}});
    const s = /** @type {any} */ (await r.json());
    if (!r.ok) throw new Error(s.detail?.message ?? r.status);
    const left = s.character_limit - s.character_count;
    const reset = s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toLocaleDateString('ru-RU') : '?';
    console.log(`ElevenLabs (${s.tier}): осталось ${left.toLocaleString('ru-RU')} из ${s.character_limit.toLocaleString('ru-RU')} кредитов, обновление ${reset}`);
    if (need) console.log(need <= left ? `  на запись ${need.toLocaleString('ru-RU')} — хватает` : `  ✗ на запись ${need.toLocaleString('ru-RU')} НЕ хватает ${(need - left).toLocaleString('ru-RU')}`);
  } catch (e) {
    console.log(`ElevenLabs: не получилось узнать остаток (${e.message}) — проверьте ключ в video/.env`);
  }
} else console.log('ElevenLabs: нет ELEVENLABS_API_KEY в video/.env — остаток не узнать (коннектор показывает цену после генерации)');

const hf = spawnSync('higgsfield account status', {encoding: 'utf8', shell: true});
const line = (`${hf.stdout}`.split('\n').find((l) => /credit/i.test(l)) ?? `${hf.stdout}`.trim().split('\n')[0]).replace(/\S+@\S+\s*[—-]?\s*/, '').trim(); // без e-mail
console.log(hf.status ? 'Higgsfield: CLI не ответил (higgsfield auth login?)' : `Higgsfield: ${line}`);

if (hasKey('OPENROUTER_API_KEY')) {
  const usd = (x) => (x === null || x === undefined ? '?' : `$${x.toFixed(x < 1 ? 4 : 2)}`);
  try {
    const {credits: c, key: k, errors} = await account();
    if (!c && !k) throw new Error(errors.join(', '));
    const bal = c && c.total !== null && c.used !== null ? `на счёте ${usd(c.total - c.used)} (пополнено ${usd(c.total)}, потрачено ${usd(c.used)})` : 'остаток счёта не узнать';
    const lim = k ? `; ключ студии: ${k.limit === null ? 'без лимита' : `лимит ${usd(k.limit)}, осталось ${usd(k.remaining)}`}, потрачено ${usd(k.usage)} (сегодня ${usd(k.daily)}, за месяц ${usd(k.monthly)})${k.freeTier ? ', бесплатный уровень' : ''}` : '';
    console.log(`OpenRouter: ${bal}${lim}`);
  } catch (e) {
    console.log(`OpenRouter: не получилось узнать остаток (${e.message}) — проверьте ключ в video/.env`);
  }
} else console.log('OpenRouter: нет OPENROUTER_API_KEY в video/.env — остаток не узнать (судья judge.mjs --backend openrouter)');
