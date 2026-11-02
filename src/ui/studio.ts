import * as THREE from 'three';
import { app, header, type Route, type Screen } from './app';
import { fileToDataURL, h, loadImage, segmented, sheet, toast } from './dom';
import { saveMeta, state } from '../game';
import { createSpecimen } from '../plant/generate';
import { Store, type SavedPlant, type StudioSettings } from '../store';
import { POT_SHAPES, TEX_H, TEX_W, drawPotTexture, type PotDeco, type PotPattern, type PotWrap } from '../pot';
import { BG_PRESETS, drawBackground, renderCard, shareOrDownload } from '../card';
import { LIGHT_PRESETS } from '../stage';
import { potIcon } from './home';
import { makeThumb } from './detail';

const POT_COLORS = ['#c96f4a', '#e9e4da', '#f5f1e8', '#2f3a35', '#1d1d1f', '#7fa38a', '#4d6fa8', '#e7b8b0', '#d9b24c', '#8a5a9e'];
const PATTERNS: { id: PotPattern; label: string }[] = [
  { id: 'none', label: '無地' },
  { id: 'stripe', label: 'ストライプ' },
  { id: 'dot', label: 'ドット' },
  { id: 'check', label: 'チェック' },
  { id: 'wave', label: 'なみ' },
];
const WRAPS: { id: PotWrap; label: string }[] = [
  { id: 'none', label: 'なし' },
  { id: 'kraft', label: 'クラフト紙' },
  { id: 'news', label: '新聞紙' },
  { id: 'linen', label: 'リネン' },
];
const BRUSH_COLORS = ['#1d1d1f', '#ffffff', '#e2483d', '#f2b632', '#3f9d5a', '#3b74d1', '#d46ab8'];
const STICKERS = ['🌵', '🌸', '⭐', '❤️', '🐸', '🍄', '🌙', '✨', '🦋', '🐌'];

export async function studioScreen(r: Route): Promise<Screen> {
  if (r.name !== 'studio') throw new Error('bad route');
  const saved = await Store.getPlant(r.plantId);
  if (!saved) {
    toast('個体が見つかりませんでした');
    return { el: h('div') };
  }
  const plant: SavedPlant = saved;
  const specimen = createSpecimen(plant.speciesId, plant.seed);
  const deco: PotDeco = { ...plant.deco, stickers: [...plant.deco.stickers] };
  const st: StudioSettings = { ...plant.studio };
  const stage = app.stage;
  let dirty = false;

  /* --- ビュー（背景キャンバス + 3D） --- */
  const bgCanvas = h('canvas', { class: 'bg-canvas', 'aria-hidden': 'true' });
  const view = h('div', { class: 'viewport studio-view' }, bgCanvas);
  stage.attach(view);
  stage.show(specimen, deco, 1);
  stage.setLight(st.light);
  if (st.cam) {
    stage.camera.position.copy(stage.controls.target).add(new THREE.Vector3(...st.cam));
    stage.controls.update();
  }
  const pot = stage.pot!;

  let bgImg: HTMLImageElement | null = st.bgImage ? await loadImage(st.bgImage).catch(() => null) : null;
  const drawBg = () => {
    const w = view.clientWidth || 360;
    const hgt = view.clientHeight || 400;
    bgCanvas.width = w;
    bgCanvas.height = hgt;
    drawBackground(bgCanvas.getContext('2d')!, w, hgt, st, bgImg);
  };
  const ro = new ResizeObserver(drawBg);
  ro.observe(view);

  const touch = () => {
    dirty = true;
  };
  const applyDeco = () => {
    const prevShape = pot.deco.shape;
    pot.setDeco(deco);
    if (prevShape !== deco.shape) {
      stage.layout();
      stage.frame();
    }
    stage.invalidate();
    touch();
  };

  /* --- ラクガキ用キャンバス --- */
  const doodle = document.createElement('canvas');
  doodle.width = TEX_W;
  doodle.height = TEX_H;
  const dctx = doodle.getContext('2d', { willReadFrequently: true })!;
  if (deco.doodle) {
    const img = await loadImage(deco.doodle).catch(() => null);
    if (img) dctx.drawImage(img, 0, 0);
  }
  let doodleChanged = false;
  // ラクガキの取り消し履歴（ペン・消しゴム・ステッカー・全消去を1手ずつ戻せる）
  const undoStack: { img: ImageData; stickers: PotDeco['stickers'] }[] = [];
  const pushUndo = () => {
    undoStack.push({ img: dctx.getImageData(0, 0, TEX_W, TEX_H), stickers: [...deco.stickers] });
    if (undoStack.length > 30) undoStack.shift();
  };
  const commitDoodle = () => {
    if (!doodleChanged) return;
    doodleChanged = false;
    const data = dctx.getImageData(0, 0, TEX_W, TEX_H).data;
    let any = false;
    for (let i = 3; i < data.length; i += 4)
      if (data[i] > 0) {
        any = true;
        break;
      }
    deco.doodle = any ? doodle.toDataURL('image/png') : null;
    applyDeco();
  };

  /* --- パネル --- */
  const panel = h('div', { class: 'studio-panel' });
  type Tab = 'pot' | 'paint' | 'bg' | 'light' | 'card';
  let tab: Tab = 'pot';

  const swatchRow = (colors: string[], cur: () => string, set: (c: string) => void, label: string) => {
    const row = h('div', { class: 'swatches' });
    const render = () =>
      row.replaceChildren(
        ...colors.map((c) =>
          h('button', {
            class: 'swatch' + (cur() === c ? ' on' : ''),
            style: `background:${c}`,
            'aria-label': `${label} ${c}`,
            onclick: () => {
              set(c);
              render();
            },
          }),
        ),
        h('label', { class: 'swatch picker', 'aria-label': `${label}を自由に選ぶ` }, h('input', {
          type: 'color',
          value: cur(),
          oninput: (e: Event) => {
            set((e.target as HTMLInputElement).value);
            render();
          },
        })),
      );
    render();
    return row;
  };

  const potPanel = () =>
    h(
      'div',
      null,
      h('h3', null, '鉢の形'),
      h(
        'div',
        { class: 'pot-choices' },
        ...POT_SHAPES.map((p) =>
          h(
            'button',
            {
              class: 'pot-choice' + (deco.shape === p.id ? ' on' : ''),
              onclick: () => {
                deco.shape = p.id;
                applyDeco();
                renderPanel();
              },
            },
            potIcon(p.id, deco.color),
            h('span', null, p.label),
          ),
        ),
      ),
      h('h3', null, '鉢の色'),
      swatchRow(POT_COLORS, () => deco.color, (c) => ((deco.color = c), applyDeco()), '鉢の色'),
      h('h3', null, '模様'),
      segmented(PATTERNS, deco.pattern, (v) => ((deco.pattern = v), applyDeco())),
      swatchRow(['#f3e9dc', '#ffffff', '#1d1d1f', '#c96f4a', '#3f7d5c', '#4d6fa8', '#d9b24c'], () => deco.patternColor, (c) => ((deco.patternColor = c), applyDeco()), '模様の色'),
      h('h3', null, 'ラッピング'),
      segmented(WRAPS, deco.wrap, (v) => ((deco.wrap = v), applyDeco())),
      h('h3', null, '仕上げ'),
      segmented(
        [
          { id: 'matte', label: 'マット（素焼き）' },
          { id: 'glossy', label: 'ツヤ（釉薬）' },
        ],
        deco.glossy ? 'glossy' : 'matte',
        (v) => ((deco.glossy = v === 'glossy'), applyDeco()),
      ),
    );

  const paintPanel = () => {
    const disp = h('canvas', { class: 'paint-canvas', width: TEX_W, height: TEX_H, 'aria-label': '鉢の展開図。指で描けます' });
    const dispCtx = disp.getContext('2d')!;
    let color = BRUSH_COLORS[0];
    let size = 10;
    let eraser = false;
    let sticker: string | null = null;
    const refresh = () => {
      drawPotTexture(dispCtx, deco, doodle);
      // 正面の目安
      dispCtx.strokeStyle = 'rgba(255,255,255,0.5)';
      dispCtx.setLineDash([8, 8]);
      dispCtx.strokeRect(TEX_W * 0.3, 4, TEX_W * 0.4, TEX_H - 8);
      dispCtx.setLineDash([]);
    };
    let raf = 0;
    const live = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        refresh();
        pot.redraw(doodle);
        stage.invalidate();
      });
    };
    refresh();
    let last: [number, number] | null = null;
    const pt = (e: PointerEvent): [number, number] => {
      const rect = disp.getBoundingClientRect();
      return [((e.clientX - rect.left) / rect.width) * TEX_W, ((e.clientY - rect.top) / rect.height) * TEX_H];
    };
    const line = (a: [number, number], b: [number, number]) => {
      dctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
      dctx.strokeStyle = color;
      dctx.lineWidth = size;
      dctx.lineCap = 'round';
      dctx.beginPath();
      dctx.moveTo(a[0], a[1]);
      dctx.lineTo(b[0], b[1]);
      dctx.stroke();
      dctx.globalCompositeOperation = 'source-over';
    };
    disp.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = pt(e);
      pushUndo();
      if (sticker) {
        deco.stickers.push({ e: sticker, x: p[0] / TEX_W, y: p[1] / TEX_H, s: 0.32 });
        pot.setDeco(deco);
        touch();
        live();
        return;
      }
      disp.setPointerCapture(e.pointerId);
      last = p;
      line(p, [p[0] + 0.1, p[1]]);
      doodleChanged = true;
      touch();
      live();
    });
    disp.addEventListener('pointermove', (e) => {
      if (!last) return;
      const p = pt(e);
      line(last, p);
      last = p;
      live();
    });
    const end = () => {
      last = null;
    };
    disp.addEventListener('pointerup', end);
    disp.addEventListener('pointercancel', end);

    const brushRow = h('div', { class: 'swatches' });
    const renderBrush = () =>
      brushRow.replaceChildren(
        ...BRUSH_COLORS.map((c) =>
          h('button', {
            class: 'swatch' + (!eraser && !sticker && color === c ? ' on' : ''),
            style: `background:${c}`,
            'aria-label': `ペンの色 ${c}`,
            onclick: () => {
              color = c;
              eraser = false;
              sticker = null;
              renderBrush();
              renderStickers();
            },
          }),
        ),
        h(
          'button',
          {
            class: 'swatch tool' + (eraser ? ' on' : ''),
            'aria-label': '消しゴム',
            onclick: () => {
              eraser = true;
              sticker = null;
              renderBrush();
              renderStickers();
            },
          },
          '⌫',
        ),
      );
    const stickerRow = h('div', { class: 'swatches' });
    const renderStickers = () =>
      stickerRow.replaceChildren(
        ...STICKERS.map((s) =>
          h(
            'button',
            {
              class: 'swatch tool' + (sticker === s ? ' on' : ''),
              'aria-label': `ステッカー ${s}`,
              onclick: () => {
                sticker = sticker === s ? null : s;
                renderBrush();
                renderStickers();
              },
            },
            s,
          ),
        ),
      );
    renderBrush();
    renderStickers();
    return h(
      'div',
      null,
      h('p', { class: 'muted small' }, '鉢の展開図に指で描けます（点線内が正面）。ステッカーを選んでタップで貼れます。'),
      disp,
      h('h3', null, 'ペン'),
      brushRow,
      h(
        'div',
        { class: 'row' },
        segmented(
          [
            { id: '5', label: '細' },
            { id: '10', label: '中' },
            { id: '22', label: '太' },
          ],
          '10',
          (v) => (size = Number(v)),
        ),
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              pushUndo();
              dctx.clearRect(0, 0, TEX_W, TEX_H);
              deco.stickers = [];
              doodleChanged = true;
              pot.setDeco(deco);
              touch();
              live();
            },
          },
          '全部消す',
        ),
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              const prev = undoStack.pop();
              if (!prev) {
                toast('これ以上戻せません');
                return;
              }
              dctx.putImageData(prev.img, 0, 0);
              deco.stickers = prev.stickers;
              doodleChanged = true;
              pot.setDeco(deco);
              touch();
              live();
            },
          },
          '1つ戻す',
        ),
      ),
      h('h3', null, 'ステッカー'),
      stickerRow,
    );
  };

  const bgPanel = () => {
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'visually-hidden',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try {
          st.bgImage = await fileToDataURL(f);
          bgImg = await loadImage(st.bgImage);
          st.bg = 'image';
          drawBg();
          touch();
          renderPanel();
        } catch {
          toast('画像を読み込めませんでした');
        }
      },
    }) as HTMLInputElement;
    return h(
      'div',
      null,
      h('h3', null, '背景'),
      h(
        'div',
        { class: 'bg-grid' },
        ...BG_PRESETS.map((b) =>
          h(
            'button',
            {
              class: 'bg-choice' + (st.bg === b.id ? ' on' : ''),
              onclick: () => {
                if (b.id === 'image' && !st.bgImage) {
                  fileInput.click();
                  return;
                }
                st.bg = b.id;
                drawBg();
                touch();
                renderPanel();
              },
            },
            h('span', { class: 'bg-sw', style: `background:${b.swatch}` }),
            h('span', null, b.label),
          ),
        ),
      ),
      st.bg === 'custom' ? swatchRow(['#e9efe6', '#f7e8e4', '#e6ecf7', '#fff7d6', '#222222', '#f2f2f2'], () => st.bgColor, (c) => ((st.bgColor = c), drawBg(), touch()), '背景色') : null,
      h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, '📷 画像を選ぶ'),
      fileInput,
      h('p', { class: 'muted small' }, '画像は端末内にのみ保存され、どこにも送信されません。'),
    );
  };

  const lightPanel = () =>
    h(
      'div',
      null,
      h('h3', null, 'ライト'),
      segmented(LIGHT_PRESETS, st.light, (v) => {
        st.light = v;
        stage.setLight(v);
        touch();
      }),
      h('h3', null, 'カメラ'),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => stage.frame() }, '視点をリセット'),
        h(
          'button',
          {
            class: 'btn ghost',
            onclick: () => {
              stage.controls.autoRotate = !stage.controls.autoRotate;
            },
          },
          '自動回転 ON/OFF',
        ),
      ),
      h('p', { class: 'muted small' }, 'ドラッグで回転、ピンチで拡大。この視点のままカード画像になります。'),
    );

  const cardPanel = () =>
    h(
      'div',
      null,
      h('h3', null, 'カードデザイン'),
      segmented(
        [
          { id: 'specimen', label: '標本ラベル' },
          { id: 'minimal', label: 'ミニマル' },
          { id: 'dark', label: 'ダーク' },
        ],
        st.frame,
        (v) => ((st.frame = v), touch()),
      ),
      h('h3', null, 'サイズ'),
      segmented(
        [
          { id: '4:5', label: '縦 4:5（投稿）' },
          { id: '9:16', label: '縦 9:16（ストーリー）' },
        ],
        st.aspect,
        (v) => ((st.aspect = v), touch()),
      ),
      h('h3', null, 'ひとこと'),
      h('input', {
        class: 'text-input',
        value: st.caption,
        maxLength: 40,
        placeholder: '例: 3日目でこの貫禄',
        oninput: (e: Event) => {
          st.caption = (e.target as HTMLInputElement).value;
          touch();
        },
      }),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: st.showInfo,
          onchange: (e: Event) => {
            st.showInfo = (e.target as HTMLInputElement).checked;
            touch();
          },
        }),
        ' 名前や特徴を載せる',
      ),
    );

  const tabs = h('div', { class: 'studio-tabs', role: 'tablist' });
  const renderTabs = () =>
    tabs.replaceChildren(
      ...(
        [
          ['pot', '鉢'],
          ['paint', 'ラクガキ'],
          ['bg', '背景'],
          ['light', 'ライト'],
          ['card', 'カード'],
        ] as [Tab, string][]
      ).map(([id, label]) =>
        h(
          'button',
          {
            class: 'stab' + (tab === id ? ' on' : ''),
            role: 'tab',
            'aria-selected': String(tab === id),
            onclick: () => {
              if (tab === 'paint') commitDoodle();
              tab = id;
              renderTabs();
              renderPanel();
            },
          },
          label,
        ),
      ),
    );
  const renderPanel = () => {
    const builders: Record<Tab, () => HTMLElement> = { pot: potPanel, paint: paintPanel, bg: bgPanel, light: lightPanel, card: cardPanel };
    panel.replaceChildren(builders[tab]());
  };
  renderTabs();
  renderPanel();

  /* --- 保存・書き出し --- */
  const persist = async () => {
    commitDoodle();
    const off = stage.camera.position.clone().sub(stage.controls.target);
    st.cam = [off.x, off.y, off.z];
    plant.deco = { ...deco, stickers: [...deco.stickers] };
    plant.studio = { ...st };
    stage.controls.update();
    plant.thumb = makeThumb(stage);
    await Store.putPlant(plant);
    dirty = false;
  };

  const exportCard = async () => {
    commitDoodle();
    const wasRot = stage.controls.autoRotate;
    stage.controls.autoRotate = false;
    const card = renderCard(stage, { ...plant, deco, studio: st }, bgImg);
    stage.controls.autoRotate = wasRot;
    const preview = h('img', { class: 'card-preview', src: card.toDataURL('image/jpeg', 0.85), alt: 'カードのプレビュー' });
    const close = sheet(
      h(
        'div',
        { class: 'export-sheet' },
        preview,
        h(
          'button',
          {
            class: 'btn primary wide big',
            onclick: async () => {
              const res = await shareOrDownload(card, `botanical-${plant.name}.png`, `${plant.name}（${plant.tags.join('・')}） #BotanicalOddities`);
              if (res === 'cancelled') return;
              state.meta.stats.exports++;
              const small = document.createElement('canvas');
              small.width = 360;
              small.height = Math.round((360 * card.height) / card.width);
              small.getContext('2d')!.drawImage(card, 0, 0, small.width, small.height);
              const thumb = small.toDataURL('image/jpeg', 0.8);
              state.meta.latestCard = thumb;
              plant.card = thumb;
              await persist();
              await saveMeta();
              toast(res === 'shared' ? '共有しました' : '画像を保存しました');
              close();
            },
          },
          '共有 / 画像を保存',
        ),
        h('p', { class: 'muted small center' }, '共有に対応していない端末では PNG をダウンロードします。'),
      ),
    );
  };

  const el = h(
    'div',
    { class: 'studio' },
    header('スタジオ', {
      back: async () => {
        if (dirty) await persist();
        app.go({ name: 'detail', plantId: plant.id });
      },
      right: h(
        'button',
        {
          class: 'btn small primary',
          onclick: async () => {
            await persist();
            toast('保存しました');
          },
        },
        '保存',
      ),
    }),
    view,
    tabs,
    panel,
    h('div', { class: 'studio-foot' }, h('button', { class: 'btn accent wide big', onclick: exportCard }, '📸 カード画像を書き出す')),
  );
  return {
    el,
    cleanup: () => {
      ro.disconnect();
      if (dirty) void persist().catch(() => undefined);
    },
  };
}
