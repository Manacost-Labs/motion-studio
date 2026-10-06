// Классы Hearthstone: понимает и ключ HearthstoneJSON (WARRIOR), и русское название («Воин», «Рыцарь смерти», «ДК»).
// classKey строгий: неизвестный класс → undefined (yt-qa: ❌ «неизвестный класс „…“»); чем его заменить в кадре,
// решает тот, кто рисует (CLASS_FALLBACK — герб и герой Воина, как раньше)
export const RU_CLASS: Record<string, string> = {
  воин: 'WARRIOR',
  шаман: 'SHAMAN',
  разбойник: 'ROGUE',
  паладин: 'PALADIN',
  охотник: 'HUNTER',
  друид: 'DRUID',
  чернокнижник: 'WARLOCK',
  маг: 'MAGE',
  жрец: 'PRIEST',
  'охотник на демонов': 'DEMONHUNTER',
  дх: 'DEMONHUNTER',
  'рыцарь смерти': 'DEATHKNIGHT',
  дк: 'DEATHKNIGHT',
};

// Базовый герой класса (портрет): id карты HearthstoneJSON
export const HERO: Record<string, string> = {
  WARRIOR: 'HERO_01',
  SHAMAN: 'HERO_02',
  ROGUE: 'HERO_03',
  PALADIN: 'HERO_04',
  HUNTER: 'HERO_05',
  DRUID: 'HERO_06',
  WARLOCK: 'HERO_07',
  MAGE: 'HERO_08',
  PRIEST: 'HERO_09',
  DEMONHUNTER: 'HERO_10',
  DEATHKNIGHT: 'HERO_11',
};

export const CLASS_FALLBACK = 'WARRIOR';

export const classKey = (cls: string): string | undefined => (HERO[cls.toUpperCase()] ? cls.toUpperCase() : RU_CLASS[cls.toLowerCase()]);

// Все классы в данных сцены: поля cls (строка) и classes (список) на любой глубине, кроме данных колоды из статьи
// (list, poster) — для проверки yt-qa. path — где лежит, как в остальных сообщениях проверки
export const unknownClasses = (seg: unknown, root: string) => {
  const found: {path: string; cls: string}[] = [];
  const check = (cls: unknown, path: string) => typeof cls === 'string' && !classKey(cls) && found.push({path, cls});
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'list' || k === 'poster') continue;
        if (k === 'cls') check(x, `${path}.${k}`);
        else if (k === 'classes' && Array.isArray(x)) x.forEach((c, i) => check(c, `${path}.${k}[${i}]`));
        else walk(x, `${path}.${k}`);
      }
  };
  walk(seg, root);
  return found;
};
