import { app, header, tabBar, type Screen } from './app';
import { confirmDialog, h, segmented, toast } from './dom';
import { state } from '../game';
import { Store, exportJSON, importJSON, saveSettings } from '../store';
import { downloadBlob } from '../card';
import type { Quality } from '../stage';

export function settingsScreen(): Screen {
  const s = state.settings;
  const save = () => saveSettings(s);
  const st = state.meta.stats;

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const n = await importJSON(await f.text());
        state.meta = await Store.getMeta();
        toast(`${n} 個体を読み込みました`);
        app.go({ name: 'home' });
      } catch (err) {
        toast('読み込みに失敗しました: ' + (err as Error).message, 4000);
      }
    },
  }) as HTMLInputElement;

  const el = h(
    'div',
    { class: 'settings' },
    header('設定'),
    h(
      'section',
      { class: 'block' },
      h('h2', null, '表示'),
      h('h3', null, '画質'),
      segmented<Quality>(
        [
          { id: 'low', label: '軽量' },
          { id: 'mid', label: '標準' },
          { id: 'high', label: '高画質' },
        ],
        s.quality,
        (v) => {
          s.quality = v;
          app.stage.setQuality(v);
          save();
        },
      ),
      h('p', { class: 'muted small' }, '動作が重いときは「軽量」にすると描画解像度と枝のポリゴン数を下げます。'),
      h('h3', null, '動きを減らす'),
      segmented(
        [
          { id: 'off', label: 'オフ' },
          { id: 'on', label: 'オン' },
        ],
        s.reduceMotion ? 'on' : 'off',
        (v) => {
          s.reduceMotion = v === 'on';
          document.documentElement.classList.toggle('reduce-motion', s.reduceMotion);
          save();
        },
      ),
      h('h3', null, '成長スピードの初期値'),
      segmented(
        [
          { id: '1', label: '×1' },
          { id: '2', label: '×2' },
          { id: '4', label: '×4' },
        ],
        String(s.defaultSpeed) as '1' | '2' | '4',
        (v) => {
          s.defaultSpeed = Number(v);
          save();
        },
      ),
    ),
    h(
      'section',
      { class: 'block' },
      h('h2', null, 'データ'),
      h('p', { class: 'muted small' }, 'セーブデータはこの端末のブラウザ内にだけ保存されます。機種変更やブラウザの変更に備えて、バックアップを書き出してください。'),
      h(
        'div',
        { class: 'row wrap' },
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: async () => {
              const json = await exportJSON();
              const d = new Date();
              downloadBlob(new Blob([json], { type: 'application/json' }), `botanical-backup-${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}.json`);
            },
          },
          'バックアップを書き出す',
        ),
        h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, 'バックアップを読み込む'),
        fileInput,
      ),
      h(
        'button',
        {
          class: 'btn danger-ghost',
          onclick: async () => {
            if (!(await confirmDialog('すべての植物・ポイント・種を消去します。元に戻せません。よろしいですか？', '全部消す'))) return;
            await Store.clearAll();
            state.meta = await Store.getMeta();
            toast('データを消去しました');
            app.go({ name: 'home' });
          },
        },
        'データをすべて消去',
      ),
    ),
    h(
      'section',
      { class: 'block' },
      h('h2', null, 'プレイ記録'),
      h(
        'dl',
        { class: 'stats' },
        h('dt', null, 'ガチャ回数'),
        h('dd', null, String(st.draws)),
        h('dt', null, '育てた数'),
        h('dd', null, String(st.grown)),
        h('dt', null, 'スキップ'),
        h('dd', null, String(st.skips)),
        h('dt', null, '書き出し'),
        h('dd', null, String(st.exports)),
      ),
    ),
    h(
      'section',
      { class: 'block about' },
      h('h2', null, 'このゲームについて'),
      h('p', { class: 'small' }, 'Botanical Oddities は、実在の塊根植物・多肉植物をモチーフにしたプロシージャル育成ゲームです。ゲーム内の成長や変異は演出であり、植物学的な正確さを保証するものではありません。'),
      h('p', { class: 'small muted' }, '3D描画: three.js（MIT License）。植物・鉢・背景・UI素材はすべてプログラムで生成しています。外部サーバーへの送信は行いません。'),
    ),
    h('div', { class: 'tab-spacer' }),
    tabBar('settings'),
  );
  return { el };
}
