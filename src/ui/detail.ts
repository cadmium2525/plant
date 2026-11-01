import { app, header, type Route, type Screen } from './app';
import { confirmDialog, h, toast } from './dom';
import { grantReward, saveMeta, state } from '../game';
import { createSpecimen } from '../plant/generate';
import { SPECIES } from '../plant/species';
import { RARITY_INFO } from '../plant/rarity';
import { defaultName } from '../plant/names';
import { seedCode } from '../rng';
import { DEFAULT_STUDIO, Store, uid, type SavedPlant } from '../store';
import { formatDate } from '../card';
import type { Stage } from '../stage';

export function makeThumb(stage: Stage): string {
  const c = stage.snapshot(320, 400);
  return c.toDataURL('image/webp', 0.82);
}

export async function detailScreen(r: Route): Promise<Screen> {
  if (r.name !== 'detail') throw new Error('bad route');
  let saved: SavedPlant | undefined = r.plantId ? await Store.getPlant(r.plantId) : undefined;
  if (r.plantId && !saved) {
    toast('個体が見つかりませんでした');
    return { el: h('div') };
  }
  const specimen = r.specimen ?? createSpecimen(saved!.speciesId, saved!.seed);
  const deco = saved?.deco ?? r.deco!;
  const def = SPECIES[specimen.speciesId];
  const ri = RARITY_INFO[specimen.rarity];
  const stage = app.stage;

  const view = h('div', { class: 'viewport detail-view' });
  stage.attach(view);
  stage.show(specimen, deco, 1);
  stage.setLight(saved?.studio.light ?? 'day');
  stage.controls.autoRotate = !state.settings.reduceMotion;

  const nameInput = h('input', {
    class: 'name-input',
    value: saved?.name ?? defaultName(specimen),
    maxLength: 16,
    'aria-label': '個体名',
  });
  const discovered = new Set(state.meta.discoveredTraits);
  const tags = h(
    'div',
    { class: 'chips' },
    ...specimen.traits.map((t) =>
      h(
        'span',
        { class: 'chip' + (t.score >= 3 ? ' rare' : '') },
        t.label,
        !saved && !discovered.has(`${specimen.speciesId}:${t.id}`) ? h('b', { class: 'new' }, 'NEW') : null,
      ),
    ),
  );
  const sk = specimen.skeleton;
  const stats = h(
    'dl',
    { class: 'stats' },
    h('dt', null, '個体ID'),
    h('dd', null, seedCode(specimen.seed)),
    h('dt', null, '樹高'),
    h('dd', null, `${Math.round(sk.height * 30)} cm`),
    h('dt', null, '枝数'),
    h('dd', null, String(sk.branches.filter((b) => !b.root).length)),
    h('dt', null, '採集日'),
    h('dd', null, formatDate(saved?.createdAt ?? Date.now())),
  );
  const actions = h('div', { class: 'detail-actions' });

  const renderActions = () => {
    if (!saved) {
      actions.replaceChildren(
        h(
          'button',
          {
            class: 'btn primary wide big',
            onclick: async () => {
              const { total, newTraits } = grantReward(specimen);
              const p: SavedPlant = {
                id: uid(),
                speciesId: specimen.speciesId,
                seed: specimen.seed,
                name: nameInput.value.trim() || defaultName(specimen),
                createdAt: Date.now(),
                rarity: specimen.rarity,
                tags: specimen.traits.map((t) => t.label),
                deco,
                studio: { ...DEFAULT_STUDIO },
                thumb: makeThumb(stage),
              };
              try {
                await Store.putPlant(p);
              } catch {
                toast('保存に失敗しました。空き容量を確認してください。', 4000);
                return;
              }
              await saveMeta();
              saved = p;
              toast(`図鑑に登録！ +${total} pt` + (newTraits.length ? `（新発見: ${newTraits.join('・')}）` : ''), 3500);
              tags.querySelectorAll('.new').forEach((n) => n.remove());
              renderActions();
            },
          },
          '図鑑に登録する',
        ),
        h('p', { class: 'muted small center' }, '登録すると育成ポイントがもらえます'),
      );
    } else {
      const s = saved;
      actions.replaceChildren(
        h('button', { class: 'btn primary wide big', onclick: () => app.go({ name: 'studio', plantId: s.id }) }, '🎨 スタジオで飾る・撮影'),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn ghost', onclick: () => app.go({ name: 'home' }) }, '温室へ'),
          h('button', { class: 'btn ghost', onclick: () => app.go({ name: 'gacha' }) }, '次の種へ'),
          h(
            'button',
            {
              class: 'btn danger-ghost',
              onclick: async () => {
                if (await confirmDialog(`「${s.name}」を手放しますか？ この操作は取り消せません。`, '手放す')) {
                  await Store.deletePlant(s.id);
                  toast('手放しました');
                  app.go({ name: 'home' });
                }
              },
            },
            '手放す',
          ),
        ),
      );
    }
  };
  renderActions();

  nameInput.addEventListener('change', async () => {
    if (!saved) return;
    saved.name = nameInput.value.trim() || saved.name;
    await Store.putPlant(saved);
    toast('名前を保存しました');
  });

  const el = h(
    'div',
    { class: 'detail' },
    header(def.name, { back: () => app.go({ name: saved ? 'zukan' : 'home' }) }),
    view,
    h(
      'div',
      { class: 'detail-panel' },
      h(
        'div',
        { class: 'row between' },
        h('div', { class: 'rarity-tag', style: `background:${ri.color}` }, '★'.repeat(ri.stars), ' ', ri.label),
        h('span', { class: 'latin' }, def.latin),
      ),
      nameInput,
      tags,
      stats,
      actions,
    ),
  );
  return { el };
}
