import { app, header, pointsBadge, tabBar, type Screen } from './app';
import { h, sheet } from './dom';
import { state } from '../game';
import { Store, type SeedItem } from '../store';
import { SPECIES } from '../plant/species';
import { makeGenes } from '../plant/generate';
import { RARITY_INFO } from '../plant/rarity';
import { DEFAULT_DECO, POT_SHAPES, type PotDeco, type PotShape } from '../pot';

const QUICK_COLORS = ['#c96f4a', '#e9e4da', '#2f3a35', '#7fa38a', '#4d6fa8', '#e7b8b0', '#d9b24c'];

export function potIcon(shape: PotShape, color: string): HTMLElement {
  const paths: Record<PotShape, string> = {
    round: 'M8 10 h32 l-2 4 q4 10 -4 26 h-20 q-8 -16 -4 -26 z',
    tall: 'M10 6 h28 v4 h-2 l-1 32 h-22 l-1 -32 h-2 z',
    bowl: 'M2 20 h44 v3 q-2 12 -10 15 h-24 q-8 -3 -10 -15 z',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${paths[shape]}" fill="${color}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>`;
  const wrap = h('span', { class: 'pot-icon' });
  wrap.append(svg);
  return wrap;
}

/** 種を植える: 鉢を選ぶシート */
export function openPlantSheet(seed: SeedItem): void {
  // 足組みガジュマルは脚が見えるよう丸鉢で
  const legs = seed.speciesId === 'gajumaru' && makeGenes(seed.speciesId, seed.seed).legs;
  const deco: PotDeco = { ...DEFAULT_DECO, shape: legs ? 'round' : SPECIES[seed.speciesId].pot };
  const sp = SPECIES[seed.speciesId];
  const shapes = h('div', { class: 'pot-choices' });
  const colors = h('div', { class: 'swatches' });
  const render = () => {
    shapes.replaceChildren(
      ...POT_SHAPES.map((p) =>
        h(
          'button',
          {
            class: 'pot-choice' + (deco.shape === p.id ? ' on' : ''),
            'aria-pressed': String(deco.shape === p.id),
            onclick: () => {
              deco.shape = p.id;
              render();
            },
          },
          potIcon(p.id, deco.color),
          h('span', null, p.label),
        ),
      ),
    );
    colors.replaceChildren(
      ...QUICK_COLORS.map((c) =>
        h('button', {
          class: 'swatch' + (deco.color === c ? ' on' : ''),
          style: `background:${c}`,
          'aria-label': `鉢の色 ${c}`,
          onclick: () => {
            deco.color = c;
            render();
          },
        }),
      ),
    );
  };
  render();
  const close = sheet(
    h(
      'div',
      { class: 'plant-sheet' },
      h('h2', null, `${sp.name}の種を植える`),
      h('p', { class: 'muted' }, '鉢を選んでください。あとからスタジオで模様やラクガキを足せます。'),
      shapes,
      colors,
      h(
        'button',
        {
          class: 'btn primary wide',
          onclick: () => {
            close();
            app.go({ name: 'grow', seed, deco });
          },
        },
        '植える',
      ),
    ),
  );
}

export async function homeScreen(): Promise<Screen> {
  const plants = await Store.allPlants();
  const m = state.meta;

  const seeds = m.inventory.length
    ? h(
        'div',
        { class: 'seed-row' },
        ...m.inventory.map((s) =>
          h(
            'button',
            {
              class: `seed-packet small r-${s.rarity}`,
              style: `--packet:${SPECIES[s.speciesId].packet}`,
              onclick: () => openPlantSheet(s),
              'aria-label': `${SPECIES[s.speciesId].name}の種を植える`,
            },
            h('span', { class: 'packet-name' }, SPECIES[s.speciesId].name),
            h('span', { class: 'packet-sub' }, '植える ›'),
          ),
        ),
      )
    : h('p', { class: 'muted small' }, '未植えの種はありません。');

  const shelf = plants.length
    ? h(
        'div',
        { class: 'shelf' },
        ...plants.map((p) =>
          h(
            'button',
            { class: 'shelf-item', onclick: () => app.go({ name: 'detail', plantId: p.id }) },
            h('img', { src: p.thumb, alt: p.name, loading: 'lazy' }),
            h('span', { class: 'shelf-name' }, h('i', { class: 'dot', style: `background:${RARITY_INFO[p.rarity].color}` }), p.name),
          ),
        ),
      )
    : h(
        'div',
        { class: 'empty' },
        h('div', { class: 'empty-art', 'aria-hidden': 'true' }, '🪴'),
        h('p', null, 'まだ温室は空っぽです。'),
        h('button', { class: 'btn primary', onclick: () => app.go({ name: 'gacha' }) }, '種ガチャを回す'),
      );

  const el = h(
    'div',
    { class: 'home' },
    header('', { right: pointsBadge() }),
    h(
      'div',
      { class: 'hero' },
      h('div', { class: 'logo' }, 'BOTANICAL', h('br'), 'ODDITIES'),
      h('p', { class: 'tagline' }, '奇妙な植物の小さな温室'),
    ),
    h('section', { class: 'block' }, h('h2', null, '未植えの種'), seeds),
    h('section', { class: 'block' }, h('h2', null, `温室 `, h('small', null, `${plants.length}鉢`)), shelf),
    m.latestCard
      ? h(
          'section',
          { class: 'block' },
          h('h2', null, '最新の作品'),
          h('img', { class: 'latest-card', src: m.latestCard, alt: '最新の作品カード' }),
        )
      : null,
    h('div', { class: 'tab-spacer' }),
    tabBar('home'),
  );
  return { el };
}
