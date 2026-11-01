import type { Stage } from '../stage';
import type { PotDeco } from '../pot';
import type { SeedItem } from '../store';
import type { Specimen } from '../plant/types';
import { h } from './dom';
import { state } from '../game';

export type Route =
  | { name: 'home' }
  | { name: 'gacha' }
  | { name: 'grow'; seed: SeedItem; deco: PotDeco }
  | { name: 'detail'; plantId?: string; specimen?: Specimen; deco?: PotDeco }
  | { name: 'studio'; plantId: string }
  | { name: 'zukan' }
  | { name: 'settings' };

export interface Screen {
  el: HTMLElement;
  cleanup?: () => void;
}

type ScreenFn = (r: Route) => Screen | Promise<Screen>;

const screens = new Map<Route['name'], ScreenFn>();
let current: Screen | null = null;
let root: HTMLElement;
let navToken = 0;

export const app = {
  stage: null as unknown as Stage,
  register(name: Route['name'], fn: ScreenFn) {
    screens.set(name, fn);
  },
  init(el: HTMLElement, stage: Stage) {
    root = el;
    app.stage = stage;
  },
  async go(r: Route) {
    const token = ++navToken;
    current?.cleanup?.();
    app.stage.detach();
    const fn = screens.get(r.name)!;
    const s = await fn(r);
    if (token !== navToken) {
      s.cleanup?.();
      return;
    }
    current = s;
    s.el.classList.add('screen', 'enter');
    root.replaceChildren(s.el);
    root.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => s.el.classList.remove('enter'));
  },
};

/** 画面下部のタブバー */
export function tabBar(active: 'home' | 'gacha' | 'zukan' | 'settings'): HTMLElement {
  const tab = (id: typeof active, icon: string, label: string) =>
    h(
      'button',
      {
        class: 'tab' + (id === active ? ' on' : ''),
        'aria-current': id === active ? 'page' : undefined,
        onclick: () => id !== active && app.go({ name: id }),
      },
      h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon),
      h('span', null, label),
    );
  return h(
    'nav',
    { class: 'tabbar' },
    tab('home', '🪴', '温室'),
    tab('gacha', '🌰', 'ガチャ'),
    tab('zukan', '📖', '図鑑'),
    tab('settings', '⚙️', '設定'),
  );
}

export function pointsBadge(): HTMLElement {
  return h('div', { class: 'points', title: '育成ポイント' }, h('span', { 'aria-hidden': 'true' }, '🌱'), ` ${state.meta.points} pt`);
}

export function header(title: string, opts: { back?: () => void; right?: HTMLElement | null } = {}): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    opts.back ? h('button', { class: 'icon-btn', 'aria-label': '戻る', onclick: opts.back }, '←') : h('span', { class: 'icon-spacer' }),
    h('h1', null, title),
    opts.right ?? h('span', { class: 'icon-spacer' }),
  );
}
