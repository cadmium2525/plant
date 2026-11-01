import { app, header, pointsBadge, tabBar, type Screen } from './app';
import { h, toast } from './dom';
import { canDraw, drawSeed, needsRescue, saveMeta, state } from '../game';
import { GACHA_COST } from '../store';
import { SPECIES } from '../plant/species';
import { RARITY_INFO } from '../plant/rarity';
import { drawSilhouette } from '../plant/silhouette';
import { openPlantSheet } from './home';

const HINTS: Record<string, string> = {
  N: 'ごく普通の種袋。でも育ててみないと分からない。',
  R: '袋がほんのり温かい……。',
  SR: '袋の中で何かがうごめいている！',
  SSR: 'まばゆい光！ 幻の個体の予感！',
};

export function gachaScreen(): Screen {
  const stageBox = h('div', { class: 'gacha-stage' });
  const ptsSlot = h('div');
  const actions = h('div', { class: 'gacha-actions' });

  const idle = () => {
    ptsSlot.replaceChildren(pointsBadge());
    stageBox.replaceChildren(
      h(
        'div',
        { class: 'packet-big idle' },
        h('span', { class: 'packet-q' }, '?'),
        h('span', { class: 'packet-label' }, 'MYSTERY SEED'),
      ),
      h('p', { class: 'muted center' }, `アデニウム／デカリアのどちらかの種が出ます。形は1粒ごとに違います。`),
    );
    const rescue = needsRescue();
    actions.replaceChildren(
      h(
        'button',
        { class: 'btn primary wide big', disabled: !canDraw() && !rescue, onclick: () => draw(rescue) },
        rescue ? 'おためし種をもらう（無料）' : `種をひく（${GACHA_COST} pt）`,
      ),
      h('p', { class: 'muted small center' }, !canDraw() && !rescue ? '植物を育てて図鑑に登録するとポイントがもらえます。' : ''),
    );
  };

  const draw = async (free: boolean) => {
    if (!free) state.meta.points -= GACHA_COST;
    state.meta.stats.draws++;
    const { item, specimen } = drawSeed();
    state.meta.inventory.push(item);
    await saveMeta();
    ptsSlot.replaceChildren(pointsBadge());
    const sp = SPECIES[item.speciesId];
    const ri = RARITY_INFO[item.rarity];
    const reduce = state.settings.reduceMotion;

    // 演出: 袋が揺れる → 開く
    const packet = h(
      'div',
      { class: `packet-big shaking r-${item.rarity}`, style: `--packet:${sp.packet}` },
      h('span', { class: 'packet-q' }, '?'),
      h('span', { class: 'packet-label' }, 'MYSTERY SEED'),
    );
    stageBox.replaceChildren(packet);
    actions.replaceChildren();
    await new Promise((r) => setTimeout(r, reduce ? 150 : 1300));

    const sil = h('canvas', { class: 'silhouette', width: 360, height: 360, 'aria-label': '樹形のシルエット' });
    drawSilhouette(sil, specimen.skeleton, '#203029');
    stageBox.replaceChildren(
      h(
        'div',
        { class: `reveal r-${item.rarity}` + (reduce ? '' : ' pop') },
        h('div', { class: 'rarity-tag', style: `background:${ri.color}` }, '★'.repeat(ri.stars), ' ', ri.label),
        h('div', { class: 'sil-wrap' }, sil),
        h('h2', null, sp.name, h('small', null, sp.latin)),
        h('p', { class: 'hint' }, HINTS[item.rarity]),
        h('p', { class: 'muted small' }, sp.desc),
      ),
    );
    actions.replaceChildren(
      h('button', { class: 'btn primary wide big', onclick: () => openPlantSheet(item) }, 'すぐ植える'),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              toast('温室にしまいました');
              app.go({ name: 'home' });
            },
          },
          '温室にしまう',
        ),
        h('button', { class: 'btn ghost', disabled: !canDraw(), onclick: idle }, 'もう一回'),
      ),
    );
  };

  idle();
  const el = h(
    'div',
    { class: 'gacha' },
    header('種ガチャ', { right: ptsSlot }),
    stageBox,
    actions,
    h('div', { class: 'tab-spacer' }),
    tabBar('gacha'),
  );
  return { el };
}
