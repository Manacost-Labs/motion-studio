// Проба «раздачи из колоды» (looks/compendium/parts/deal.tsx) в обстановке «Компендиума»: пергамент, шапка из сукна,
// стопка слева, 12 карт колоды-образца (1-е место образца статьи, games/hearthstone/fixtures) раздаются в две строки,
// доска стоит, чтобы разглядеть карты целиком. Не для публикации.
// Частота — как у роликов канала (Root.tsx: YT_BASE.fps, в черновике render.ps1 -Draft — 30 к/с); всё движение — в «кадрах-30»
// (FrameScale по настоящей частоте композиции), поэтому одинаково при любой частоте
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {BASE_FPS, FrameScale, useFrame} from '../../../core/time/fps';
import {Sfx} from '../../../core/audio/Sfx';
import {SAMPLE_ARTICLE as article} from '../../../games/hearthstone/fixtures';
import {hsRender} from '../../../games/hearthstone/data/assets';
import {crestFor} from '../../../games/hearthstone/scenes/parts';
import {compendium} from '../../../looks/compendium/look';
import {CARD_RATIO, DeckDeal, dealCue, HeaderBand, Page} from '../../../looks/compendium/parts';
import {EASE_IN_OUT, H, ramp, TEXT} from '../../../looks/compendium/theme';

const deck = article.decks.find((d) => d.rank === 1)!;
// 12 карт колоды по стоимости (без повторов): дешёвые, середина и тяжёлые — разные рамки и форматы
const IDS = ['CAP_107', 'CATA_556', 'CORE_REV_990', 'EDR_456', 'FIR_939', 'CAP_105', 'EDR_457', 'CATA_584', 'JAIL_421', 'CORE_SW_066', 'END_033', 'TLC_600'];
const CARDS = IDS.map(hsRender);

// Раскладка 1920×1080: стопка слева, места — две строки по шесть, карты целиком
const CH = 340;
const CW = CH * CARD_RATIO;
const GAP = 26;
const X0 = 1860 - (6 * CW + 5 * GAP);
const SLOTS = IDS.map((_, k) => ({x: X0 + CW / 2 + (k % 6) * (CW + GAP), y: k < 6 ? 362 : 738}));
const PILE = {x: 200, y: 560};

// Ход (в «кадрах-30»): стопка проявляется, замах, раздача (~3 с), доска стоит ~4 с, карты гаснут
const AT = 24; // первая карта уходит
const LEN = 240;
export const DEAL_LAB_SEC = LEN / BASE_FPS;

export const DealLab: React.FC = () => {
  const K = useVideoConfig().fps / BASE_FPS;
  return (
    <FrameScale value={K}>
      <AbsoluteFill>
        <Page />
        <HeaderBand kicker="Проба движения · колода" title={deck.name} crest={crestFor(deck.cls)} />
        <Deal />
        <div style={{position: 'absolute', left: 88, right: 60, top: 975, fontFamily: TEXT, fontWeight: 600, fontSize: 26, color: H.inkMuted}}>
          Раздача из колоды · интервал 6 → 4,2 кадра · полёт 14–28 кадров по дальности + посадка 4 · тень позже на 3
        </div>
        {compendium.Overlay ? <compendium.Overlay /> : null}
      </AbsoluteFill>
    </FrameScale>
  );
};

const Deal: React.FC = () => {
  const f = useFrame();
  const show = ramp(f, 0, 8) * (1 - ramp(f, LEN - 12, LEN - 2, EASE_IN_OUT));
  return (
    <AbsoluteFill style={{opacity: show}}>
      <DeckDeal cards={CARDS} slots={SLOTS} h={CH} pile={PILE} at={AT} />
      {/* Отделка тише голоса (S2 рецепта): щелчки первых карт по убыванию, дальше раздача сливается в один шорох */}
      <Sfx file="lib/sfx/card-draw.wav" at={AT} volume={0.18} />
      <Sfx file="lib/sfx/card-draw.wav" at={dealCue(AT, 1)} volume={0.13} />
      <Sfx file="lib/sfx/card-draw.wav" at={dealCue(AT, 2)} volume={0.09} />
      <Sfx file="lib/sfx/card-shuffle.wav" at={dealCue(AT, 3)} volume={0.1} />
    </AbsoluteFill>
  );
};
