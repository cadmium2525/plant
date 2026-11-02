import { app, header, type Route, type Screen } from './app';
import { confirmDialog, h, segmented } from './dom';
import { saveMeta, state } from '../game';
import { createSpecimen } from '../plant/generate';
import { SPECIES } from '../plant/species';

export function growScreen(r: Route): Screen {
  if (r.name !== 'grow') throw new Error('bad route');
  const { seed, deco } = r;
  const specimen = createSpecimen(seed.speciesId, seed.seed);
  const def = SPECIES[seed.speciesId];
  const stage = app.stage;

  const view = h('div', { class: 'viewport grow-view' });
  const phase = h('div', { class: 'phase-label' }, '発芽');
  const eventLayer = h('div', { class: 'event-layer', 'aria-live': 'polite' });
  const bar = h('div', { class: 'progress-fill' });
  const timeLabel = h('span', { class: 'muted small' });
  view.append(phase, eventLayer);

  let t = 0;
  let speed = state.settings.defaultSpeed || 1;
  let done = false;
  let evIdx = 0;
  let userHold = 0;

  stage.attach(view);
  stage.show(specimen, deco, 0);
  const plant = stage.plant!;
  const reduce = state.settings.reduceMotion;
  stage.controls.autoRotate = !reduce;
  const onStart = () => {
    userHold = 3;
    stage.controls.autoRotate = false;
  };
  stage.controls.addEventListener('start', onStart);
  const baseTarget = stage.controls.target.y;

  const phaseName = (x: number): string => {
    const t0 = def.phase.t0;
    if (x < 0.06) return '発芽';
    if (x < t0) return def.phase.base;
    if (x < 0.45) return def.id === 'dioscorea' ? 'つるが伸びる' : '幹が伸びる';
    if (x < 0.78) return '枝分かれ・展葉';
    if (x < 1) return def.phase.last;
    return '成熟';
  };

  const showEvent = (label: string) => {
    const e = h('div', { class: 'event-pop' }, label);
    eventLayer.append(e);
    setTimeout(() => e.remove(), 1800);
  };

  const finish = async () => {
    if (done) return;
    done = true;
    stage.onFrame = null;
    plant.update(1);
    stage.invalidate();
    state.meta.inventory = state.meta.inventory.filter((i) => i.id !== seed.id);
    await saveMeta();
    phase.textContent = '成熟！';
    phase.classList.add('done');
    setTimeout(() => app.go({ name: 'detail', specimen, deco }), reduce ? 200 : 900);
  };

  stage.onFrame = (dt) => {
    if (done) return;
    t += (dt / def.duration) * speed;
    if (userHold > 0) {
      userHold -= dt;
      if (userHold <= 0 && !reduce) stage.controls.autoRotate = true;
    }
    plant.update(t);
    // 成長に合わせて注視点を少しずつ上げる
    const hy = plant.heightAt(t);
    stage.controls.target.y += (Math.min(baseTarget, hy * 0.5) - stage.controls.target.y) * Math.min(1, dt * 2);
    while (evIdx < specimen.skeleton.events.length && specimen.skeleton.events[evIdx].t <= t) {
      showEvent(specimen.skeleton.events[evIdx].label);
      evIdx++;
    }
    phase.textContent = phaseName(t);
    bar.style.width = `${Math.min(100, t * 100)}%`;
    const remain = Math.max(0, ((1 - t) * def.duration) / speed);
    timeLabel.textContent = `残り約 ${Math.ceil(remain)} 秒`;
    if (t >= 1) finish();
  };
  // 開始直後は下の方を見る
  stage.controls.target.y = 0;

  const el = h(
    'div',
    { class: 'grow' },
    header(def.name + 'を育成中', {
      back: async () => {
        if (await confirmDialog('育成を中断しますか？ 種は温室に残ります。', '中断する')) app.go({ name: 'home' });
      },
    }),
    view,
    h(
      'div',
      { class: 'grow-panel' },
      h('div', { class: 'progress', role: 'progressbar' }, bar),
      h(
        'div',
        { class: 'row between' },
        timeLabel,
        segmented(
          [
            { id: '1', label: '×1' },
            { id: '2', label: '×2' },
            { id: '4', label: '×4' },
          ],
          String(speed) as '1' | '2' | '4',
          (v) => (speed = Number(v)),
        ),
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              state.meta.stats.skips++;
              t = 1;
              finish();
            },
          },
          'スキップ',
        ),
      ),
      h('p', { class: 'muted small center' }, 'ドラッグで回転・ピンチで拡大できます'),
    ),
  );
  return {
    el,
    cleanup: () => {
      stage.controls.removeEventListener('start', onStart);
      stage.onFrame = null;
    },
  };
}
