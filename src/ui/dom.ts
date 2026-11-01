type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** 小さな DOM ビルダー */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

let toastTimer = 0;
export function toast(msg: string, ms = 2200): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), ms);
}

/** 下からのシート / モーダル */
export function sheet(content: HTMLElement, opts: { onClose?: () => void; center?: boolean } = {}): () => void {
  const back = h('div', { class: 'sheet-back' + (opts.center ? ' center' : '') });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, content);
  back.append(panel);
  const close = () => {
    back.classList.remove('show');
    setTimeout(() => back.remove(), 220);
    opts.onClose?.();
  };
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
  });
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('show'));
  return close;
}

export function confirmDialog(msg: string, ok = 'OK', cancel = 'キャンセル'): Promise<boolean> {
  return new Promise((res) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      res(v);
      close();
    };
    const body = h(
      'div',
      { class: 'dialog' },
      h('p', null, msg),
      h(
        'div',
        { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => finish(false) }, cancel),
        h('button', { class: 'btn primary', onclick: () => finish(true) }, ok),
      ),
    );
    const close = sheet(body, { center: true, onClose: () => finish(false) });
  });
}

export function segmented<T extends string>(
  items: { id: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup' });
  const render = (cur: T) => {
    wrap.replaceChildren(
      ...items.map((it) =>
        h(
          'button',
          {
            class: 'seg-item' + (it.id === cur ? ' on' : ''),
            role: 'radio',
            'aria-checked': String(it.id === cur),
            onclick: () => {
              render(it.id);
              onChange(it.id);
            },
          },
          it.label,
        ),
      ),
    );
  };
  render(value);
  return wrap;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** 画像ファイルを最大辺 max に縮小して dataURL に */
export async function fileToDataURL(file: File, max = 1080): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
