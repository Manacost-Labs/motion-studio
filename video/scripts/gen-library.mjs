// Генерирует библиотеку ассетов для будущих роликов в Higgsfield и складывает её в public/lib.
//   node scripts/gen-library.mjs            — всё, чего ещё нет
//   node scripts/gen-library.mjs bg chars   — только выбранные категории
// Готовые файлы пропускаются (можно перезапускать). Описание каждого ассета — в public/lib/manifest.json.
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HF = path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/@higgsfield/cli/vendor/hf.exe');
const LIB = path.resolve('public/lib');
const MANIFEST = path.join(LIB, 'manifest.json');
const CONCURRENCY = 5; // у тарифа Plus лимит 6 одновременных задач

// Общий стиль: оригинальная фэнтези-иллюстрация «как в коллекционной карточной игре», без чужих персонажей
const STYLE =
  'Hand-painted digital fantasy illustration in the style of a cozy collectible card game: warm dramatic lighting, rich saturated colors with burgundy, gold and deep purple accents, painterly brush strokes, stylized chunky shapes, high detail. No text, no letters, no logos, no watermark.';
const CUTOUT = 'Full body, isolated on a fully transparent background, clean silhouette, no ground, no shadow.';

// ─── Фоны-локации: каждая в двух ориентациях ───
const SCENES = {
  tavern: 'Cozy fantasy tavern interior, roaring stone fireplace, heavy wooden beams, a round card-game table with glowing magical cards and gold coins in the foreground, warm candlelight, empty of people.',
  arena: 'Grand fantasy coliseum arena at golden dusk, empty sand floor, towering stone stands, colorful banners and burning braziers, epic scale, empty of people.',
  library: 'Vast arcane library with towering bookshelves, floating glowing books and tomes, drifting magical runes, purple and golden light, empty of people.',
  'crystal-cave': 'Mystical underground cave full of huge glowing blue and violet crystals, soft fog, shimmering reflections in a still pool, empty of people.',
  forge: 'Dwarven forge hall inside a mountain, rivers of molten metal, glowing anvils, flying sparks, warm orange light, empty of people.',
  'frozen-citadel': 'Frozen citadel throne hall made of ice and dark stone, cold blue glow, falling snow, ominous but beautiful, empty throne, empty of people.',
  'jungle-temple': 'Ancient jungle temple ruins overgrown with vines and flowers, golden sunset rays, stone idols, lush and colorful, empty of people.',
  'night-sky': 'Magical night sky over misty mountains, swirling golden stars and aurora ribbons, glowing constellations, deep purple and gold, empty landscape.',
  'game-board': 'Top-down view of an ornate wooden fantasy game board on a tavern table, scattered glowing cards, gold coins, gems and candles around the edges, empty center.',
  'treasure-vault': 'Treasure vault full of gold coins, open chests, jewels and golden trophies, warm glittering light, empty of people.',
  'inn-exterior': 'Cozy fantasy inn exterior at snowy night, warm glowing windows, lanterns, wooden sign without text, soft snowfall, empty street.',
  battlefield: 'Epic magical battlefield at dusk seen from afar, silhouettes of two distant armies, swirling spells and light beams in the sky, dramatic clouds.',
};

// ─── Оригинальные герои на прозрачном фоне ───
const CHARS = {
  'dwarf-innkeeper': 'A jolly dwarf innkeeper with a braided red beard and leather apron raising a foaming tankard, friendly welcoming pose.',
  'elf-ranger': 'An elven ranger in a green hooded cloak drawing a glowing magical bow, determined look.',
  'orc-berserker': 'A muscular orc berserker with two battle axes, fur and leather armor, mid battle roar.',
  'gnome-tinker': 'A cheerful gnome inventor with brass goggles and a clockwork backpack holding a sparking gadget.',
  necromancer: 'An undead necromancer in tattered violet robes casting swirling green soul magic, skull staff.',
  paladin: 'A human paladin woman in shining gold-and-white plate armor raising a glowing warhammer, heroic pose.',
  'troll-shaman': 'A lanky troll shaman with tusks and tribal paint holding a totem staff crackling with lightning.',
  druid: 'A druid with antlers and leafy robes summoning swirling green nature magic, calm powerful pose.',
  'pirate-rogue': 'A swashbuckling pirate rogue in a tricorn hat with a cutlass and a confident smirk.',
  'goblin-merchant': 'A grinning goblin merchant holding a heavy sack of gold coins, shrewd and funny.',
  'frost-mage': 'A frost mage sorceress in blue robes with an icy staff, swirling snowflakes and frost magic.',
  priestess: 'A celestial priestess in white and gold robes with a glowing halo holding radiant holy light.',
  'mech-bot': 'A cute small mechanical robot companion made of brass and copper with a glowing blue core, waving.',
  'dragon-whelp': 'A small cute red dragon whelp with golden horns flapping its wings playfully.',
};

// ─── Предметы и иконки на прозрачном фоне ───
const PROPS = {
  'card-back': ['2:3', 'high', 'An ornate collectible card back, portrait card shape with rounded corners, burgundy leather with intricate gold filigree border, a central golden emblem of a flame with a heartbeat line like the reference image.', true],
  'card-frame': ['2:3', 'medium', 'A blank collectible card frame: ornate gold and stone border, empty oval art window at the top, empty parchment text box at the bottom, no text.'],
  'gold-frame': ['16:9', 'high', 'An ornate empty rectangular gold picture frame with gems in the corners, empty transparent center.'],
  'ribbon-banner': ['21:9', 'high', 'An empty horizontal ribbon banner of burgundy cloth with gold edges and folded ends, no text.'],
  'chest-open': ['1:1', 'high', 'An open wooden treasure chest bound in gold, overflowing with coins and gems, glowing golden light pouring out.'],
  'coins-pile': ['1:1', 'high', 'A pile of shiny gold coins with a few gems.'],
  'mana-gem': ['1:1', 'high', 'A glowing blue hexagonal mana crystal in a gold setting, magical sparkles.'],
  trophy: ['1:1', 'high', 'A golden trophy cup decorated with rubies and laurel, gleaming.'],
  scroll: ['3:2', 'medium', 'An unrolled blank parchment scroll with wooden handles, no writing.'],
  spellbook: ['1:1', 'medium', 'An open ancient spellbook with glowing violet pages and floating runes.'],
  potion: ['1:1', 'medium', 'A bubbling round potion bottle with glowing pink liquid and a cork.'],
  'icon-arena': ['1:1', 'medium', 'A game emblem icon: two crossed swords over a round wooden shield with gold trim.'],
  'icon-tavern': ['1:1', 'medium', 'A game emblem icon: a hanging wooden tavern sign with a carved foaming mug, no text.'],
  'icon-standard': ['1:1', 'medium', 'A game emblem icon: a heraldic gold and burgundy shield with a star.'],
  'icon-wild': ['1:1', 'medium', 'A game emblem icon: a golden hourglass wrapped in swirling purple magic.'],
  'icon-legend': ['1:1', 'medium', 'A game emblem icon: a jeweled golden crown with a glowing orange gem.'],
  'icon-stats': ['1:1', 'medium', 'A game emblem icon: a rising bar chart made of glowing golden crystals on a stone plinth.'],
  'icon-matchups': ['1:1', 'medium', 'A game emblem icon: two playing cards crossed against each other with a glowing versus spark between them, no text.'],
};

// ─── Эффекты на чёрном фоне (накладываются в режиме «экран») ───
const FX = {
  'sparkle-burst': 'A burst of golden magical sparkles and glowing particles on a pure black background.',
  'magic-smoke': 'Wisps of soft violet and gold magical smoke on a pure black background.',
  'god-rays': 'Warm golden god rays of light streaming diagonally on a pure black background.',
  'gold-dust': 'A curved trail of glittering gold dust on a pure black background.',
};

// ─── Музыка и звуки ───
const MUSIC = {
  'epic-45': [45, 'Epic fantasy tavern trailer music, instrumental, steady strong beat around 120 BPM. Big brass and choir hit at 3 seconds, driving celtic groove with fiddle, lute, frame drums and staccato strings, rising energy, huge final orchestral hit at 42 seconds ringing out. No vocals.'],
  'tavern-30': [30, 'Cozy fantasy tavern music, instrumental, warm lute, fiddle, hand drums and soft flute, relaxed cheerful groove around 100 BPM, loopable, no vocals.'],
  'hype-15': [15, 'Short energetic fantasy promo sting, instrumental: fast taiko and brass build for 3 seconds, heroic orchestral burst, ends with a big hit at 13 seconds. No vocals.'],
  'announce-20': [20, 'Upbeat fantasy announcement music, instrumental, bright strings, glockenspiel and hand drums, playful and exciting, clear beat, final hit at 18 seconds. No vocals.'],
  'mystic-30': [30, 'Mysterious arcane fantasy ambient music, instrumental, shimmering harp, soft choir pads, low drones and gentle chimes, slow and magical, no drums, no vocals.'],
};
const SFX = {
  'card-draw': 'a single playing card being drawn and slid quickly across a wooden table',
  'card-shuffle': 'a deck of thick playing cards being shuffled',
  'coin-single': 'a single gold coin dropping and ringing on a wooden table',
  'coin-pile': 'a handful of gold coins pouring into a pile',
  'gem-sparkle': 'a magical gem sparkle chime, bright and short',
  'level-up': 'a short triumphant fantasy level up chime with a magical shimmer',
  'magic-whoosh': 'a fast magical whoosh with sparkles',
  riser: 'a cinematic rising swell building tension for two seconds, ending abruptly',
  'drum-hit': 'one huge cinematic taiko drum hit with a short tail',
  fanfare: 'a short heroic brass fanfare of three notes',
  notification: 'a soft pleasant magical notification ding',
  'page-turn': 'a single old book page turning',
  'scroll-unroll': 'a parchment scroll being unrolled',
  'sword-clash': 'two swords clashing once with a metallic ring',
  'fire-crackle': 'a cozy fireplace crackling, ambient, steady',
  'tavern-crowd': 'a fantasy tavern crowd murmuring and laughing softly with mugs clinking, ambient',
  'ui-click': 'a soft wooden interface click, very short',
  'ui-hover': 'a very soft subtle magical interface hover tick',
  bell: 'a single bright bell ring with a long shimmering tail',
  'stone-slide': 'a heavy stone slab sliding open',
  'heartbeat-deep': 'one deep warm cinematic heartbeat thump with a soft magical shimmer after it',
};

// ─── Список задач ───
const jobs = [];
for (const [id, p] of Object.entries(SCENES)) {
  for (const [suf, ar] of [['v', '9:16'], ['h', '16:9']]) {
    jobs.push({cat: 'bg', file: `bg/${id}-${suf}.png`, model: 'gpt_image_2_5', args: ['--aspect_ratio', ar, '--resolution', '2k', '--quality', 'high', '--prompt', `${p} Cinematic composition. ${STYLE}`]});
  }
}
for (const [id, p] of Object.entries(CHARS)) {
  jobs.push({cat: 'chars', file: `chars/${id}.png`, model: 'gpt_image_2_5', args: ['--aspect_ratio', '2:3', '--resolution', '2k', '--quality', 'high', '--background', 'transparent', '--prompt', `${p} ${CUTOUT} ${STYLE}`]});
}
for (const [id, [ar, q, p, withLogo]] of Object.entries(PROPS)) {
  const ref = withLogo ? ['--image', path.resolve('public/brand/hearthpulse-logo-hd.png')] : [];
  jobs.push({cat: 'props', file: `props/${id}.png`, model: 'gpt_image_2_5', args: ['--aspect_ratio', ar, '--resolution', '2k', '--quality', q, '--background', 'transparent', ...ref, '--prompt', `${p} Isolated object on a fully transparent background. ${STYLE}`]});
}
for (const [id, p] of Object.entries(FX)) {
  jobs.push({cat: 'fx', file: `fx/${id}.png`, model: 'gpt_image_2_5', args: ['--aspect_ratio', '16:9', '--resolution', '2k', '--quality', 'medium', '--prompt', `${p} Only light and particles, nothing else.`]});
}
for (const [id, [dur, p]] of Object.entries(MUSIC)) {
  jobs.push({cat: 'music', file: `music/${id}.m4a`, model: 'sonilo_music', args: ['--duration', String(dur), '--prompt', p]});
}
for (const [id, p] of Object.entries(SFX)) {
  jobs.push({cat: 'sfx', file: `sfx/${id}.wav`, model: 'seed_audio', args: ['--sample_rate', '48000', '--prompt', `Sound effect only: ${p}. No music, no voice.`]});
}

// ─── Живые фоны: зацикленные 5-секундные клипы (первый кадр = последний) из вертикальных фонов ───
const LOOPS = {
  tavern: 'The fire in the fireplace flickers, candle flames dance, the magical cards on the table softly glow and pulse, dust motes drift in the warm light.',
  arena: 'Banners ripple in the wind, brazier flames flicker, golden dust drifts over the sand, clouds move slowly across the dusk sky.',
  library: 'Books and tomes float and drift gently, glowing runes swirl slowly, candle light flickers, magical particles rise.',
  'crystal-cave': 'Crystals pulse with soft glowing light, fog drifts slowly, gentle ripples spread across the still pool, sparkles twinkle.',
  'night-sky': 'Golden stars swirl slowly, aurora ribbons wave gently, constellations twinkle, mist drifts over the mountains.',
};
for (const [id, p] of Object.entries(LOOPS)) {
  const img = path.join(LIB, `bg/${id}-v.png`);
  jobs.push({
    cat: 'loops',
    file: `loops/${id}-v.mp4`,
    model: 'seedance_2_5',
    needs: img,
    args: ['--mode', 'omni_reference', '--start-image', img, '--end-image', img, '--duration', '5', '--resolution', '1080p', '--aspect_ratio', '9:16', '--generate_audio', 'false', '--prompt', `Seamless ambient loop, static camera, the scene ends exactly as it starts. ${p} Keep the painterly illustration style, subtle smooth motion.`],
  });
}

// ─── Выполнение ───
const only = process.argv.slice(2);
const todo = jobs.filter((j) => (!only.length || only.includes(j.cat)) && !fs.existsSync(path.join(LIB, j.file)));
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
console.log(`К генерации: ${todo.length} из ${jobs.length}`);

const run = (args) =>
  new Promise((resolve) => {
    execFile(HF, args, {maxBuffer: 1 << 24, timeout: 45 * 60 * 1000}, (err, stdout, stderr) => resolve({err, out: `${stdout}${stderr}`}));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doJob(j) {
  const dest = path.join(LIB, j.file);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (j.needs && !fs.existsSync(j.needs)) return console.log(`${j.file}: нет исходника ${path.basename(j.needs)}, пропуск`);
    const {out} = await run(['generate', 'create', j.model, ...j.args, '--wait', '--wait-timeout', '40m', '--json']);
    let res;
    try {
      res = JSON.parse(out.slice(out.indexOf('[')))[0];
    } catch {
      if (/rate_limit|503|timeout/i.test(out)) {
        await sleep(20000 * attempt);
        continue;
      }
      return console.log(`${j.file}: ОШИБКА ${out.slice(0, 200).replace(/\s+/g, ' ')}`);
    }
    if (res.status !== 'completed' || !res.result_url) return console.log(`${j.file}: ${res.status}`);
    const buf = Buffer.from(await (await fetch(res.result_url)).arrayBuffer());
    fs.writeFileSync(dest, buf);
    manifest[j.file] = {category: j.cat, model: j.model, jobId: res.id, width: res.params?.width, height: res.params?.height, prompt: j.args[j.args.indexOf('--prompt') + 1]};
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    return console.log(`${j.file}: OK`);
  }
  console.log(`${j.file}: не удалось после повторов`);
}

// Сначала всё, кроме живых фонов (им нужны готовые вертикальные фоны), затем живые фоны
const queue = [...todo.filter((j) => j.cat !== 'loops'), ...todo.filter((j) => j.cat === 'loops')];
let next = 0;
await Promise.all(
  Array.from({length: CONCURRENCY}, async () => {
    while (next < queue.length) await doJob(queue[next++]);
  }),
);
console.log('Готово');
