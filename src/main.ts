import './style.css';
import { Stage, webglAvailable } from './stage';
import { Store, loadSettings } from './store';
import { state } from './game';
import { app } from './ui/app';
import { h } from './ui/dom';
import { homeScreen } from './ui/home';
import { gachaScreen } from './ui/gacha';
import { growScreen } from './ui/grow';
import { detailScreen } from './ui/detail';
import { studioScreen } from './ui/studio';
import { zukanScreen } from './ui/zukan';
import { settingsScreen } from './ui/settings';
import { createSpecimen } from './plant/generate';
import { DEFAULT_DECO } from './pot';
import { SPECIES, isSpeciesId } from './plant/species';

async function boot() {
  const root = document.getElementById('app')!;
  if (!webglAvailable()) {
    root.replaceChildren(
      h(
        'div',
        { class: 'fallback' },
        h('h1', null, 'BOTANICAL ODDITIES'),
        h('p', null, 'お使いのブラウザでは 3D 表示（WebGL）が利用できないため、ゲームを開始できません。'),
        h('p', { class: 'muted small' }, '最新の Chrome / Safari / Edge でお試しいただくか、ブラウザ設定でハードウェアアクセラレーションを有効にしてください。'),
      ),
    );
    return;
  }
  state.settings = loadSettings();
  document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
  try {
    state.meta = await Store.getMeta();
  } catch {
    root.replaceChildren(
      h('div', { class: 'fallback' }, h('h1', null, 'BOTANICAL ODDITIES'), h('p', null, '端末内ストレージ（IndexedDB）を開けませんでした。プライベートブラウズを解除して再読み込みしてください。')),
    );
    return;
  }
  const stage = new Stage();
  stage.setQuality(state.settings.quality);
  app.init(root, stage);
  app.register('home', homeScreen);
  app.register('gacha', gachaScreen);
  app.register('grow', growScreen);
  app.register('detail', detailScreen);
  app.register('studio', studioScreen);
  app.register('zukan', zukanScreen);
  app.register('settings', settingsScreen);
  // 開発用: ?debug=adenium:12345 でシード指定の個体を直接表示（シード再現の確認用）
  const dbg = new URLSearchParams(location.search).get('debug');
  if (dbg) {
    const [sp, seed] = dbg.split(':');
    if (isSpeciesId(sp) && seed) {
      const specimen = createSpecimen(sp, Number(seed) >>> 0);
      await app.go({ name: 'detail', specimen, deco: { ...DEFAULT_DECO, shape: specimen.genes.legs ? 'round' : SPECIES[sp].pot } });
      return;
    }
  }
  await app.go({ name: 'home' });
}

boot();
