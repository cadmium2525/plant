import { app, header, tabBar, type Screen } from './app';
import { h, segmented } from './dom';
import { state } from '../game';
import { Store, type SavedPlant } from '../store';
import { SPECIES, SPECIES_IDS } from '../plant/species';
import { RARITY_INFO, TRAIT_CATALOG } from '../plant/rarity';
import type { Rarity, SpeciesId } from '../plant/types';
import { formatDate } from '../card';

export async function zukanScreen(): Promise<Screen> {
  const all = await Store.allPlants();
  let sp: 'all' | SpeciesId = 'all';
  let rar: 'all' | Rarity = 'all';
  let q = '';
  let sort: 'new' | 'rare' = 'new';
  const grid = h('div', { class: 'zukan-grid' });
  const count = h('span', { class: 'muted small' });
  const order: Rarity[] = ['SSR', 'SR', 'R', 'N'];

  const render = () => {
    const query = q.trim();
    let list = all.filter(
      (p) =>
        (sp === 'all' || p.speciesId === sp) &&
        (rar === 'all' || p.rarity === rar) &&
        (!query || p.name.includes(query) || p.tags.some((t) => t.includes(query)) || SPECIES[p.speciesId].name.includes(query)),
    );
    if (sort === 'rare') list = [...list].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
    count.textContent = `${list.length} / ${all.length} 個体`;
    grid.replaceChildren(
      ...(list.length
        ? list.map((p: SavedPlant) =>
            h(
              'button',
              { class: 'zcard', onclick: () => app.go({ name: 'detail', plantId: p.id }) },
              h('img', { src: p.thumb, alt: '', loading: 'lazy' }),
              h('span', { class: 'zr', style: `background:${RARITY_INFO[p.rarity].color}` }, p.rarity),
              h('b', null, p.name),
              h('small', null, `${SPECIES[p.speciesId].name}・${formatDate(p.createdAt)}`),
              h('small', { class: 'ztags' }, p.tags.slice(0, 3).join(' / ')),
            ),
          )
        : [h('p', { class: 'muted center wide-cell' }, all.length ? '条件に合う個体がありません' : 'まだ登録された個体はありません')]),
    );
  };

  const discovered = new Set(state.meta.discoveredTraits);
  const catalog = h(
    'div',
    null,
    ...SPECIES_IDS.map((id) => {
      const items = TRAIT_CATALOG[id];
      const got = items.filter((t) => discovered.has(`${id}:${t.id}`)).length;
      return h(
        'div',
        { class: 'catalog' },
        h('h3', null, SPECIES[id].name, h('small', null, ` 特徴の発見 ${got} / ${items.length}`)),
        h('div', { class: 'progress thin' }, h('div', { class: 'progress-fill', style: `width:${(got / items.length) * 100}%` })),
        h(
          'div',
          { class: 'chips' },
          ...items.map((t) =>
            discovered.has(`${id}:${t.id}`) ? h('span', { class: 'chip' }, t.label) : h('span', { class: 'chip locked' }, '？？？'),
          ),
        ),
      );
    }),
  );

  const el = h(
    'div',
    { class: 'zukan' },
    header('図鑑'),
    h(
      'div',
      { class: 'filters' },
      segmented(
        [
          { id: 'all', label: 'すべて' },
          ...SPECIES_IDS.map((id) => ({ id, label: SPECIES[id].name })),
        ] as { id: 'all' | SpeciesId; label: string }[],
        sp,
        (v) => ((sp = v), render()),
      ),
      segmented(
        [{ id: 'all', label: '全レア度' }, ...order.map((r) => ({ id: r, label: RARITY_INFO[r].label }))] as { id: 'all' | Rarity; label: string }[],
        rar,
        (v) => ((rar = v), render()),
      ),
      h(
        'div',
        { class: 'row' },
        h('input', {
          class: 'text-input',
          type: 'search',
          placeholder: '名前・特徴で検索',
          'aria-label': '検索',
          oninput: (e: Event) => ((q = (e.target as HTMLInputElement).value), render()),
        }),
        segmented(
          [
            { id: 'new', label: '新着' },
            { id: 'rare', label: 'レア順' },
          ],
          sort,
          (v) => ((sort = v), render()),
        ),
      ),
      count,
    ),
    grid,
    h('section', { class: 'block' }, h('h2', null, '特徴コレクション'), catalog),
    h('div', { class: 'tab-spacer' }),
    tabBar('zukan'),
  );
  render();
  return { el };
}
