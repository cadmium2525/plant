import type { Stage } from './stage';
import type { SavedPlant, StudioSettings } from './store';
import { SPECIES } from './plant/species';
import { RARITY_INFO } from './plant/rarity';
import { seedCode } from './rng';

export const BG_PRESETS: { id: string; label: string; swatch: string }[] = [
  { id: 'paper', label: '紙', swatch: '#efe8da' },
  { id: 'mint', label: 'ミント', swatch: 'linear-gradient(#e3f0e7,#b5d4c2)' },
  { id: 'dusk', label: '夕焼け', swatch: 'linear-gradient(#f7cfae,#8e7cb6)' },
  { id: 'night', label: '夜', swatch: 'linear-gradient(#2a3242,#0d1118)' },
  { id: 'greenhouse', label: '温室', swatch: 'linear-gradient(#dfeef2,#a9c8b0)' },
  { id: 'concrete', label: 'コンクリ', swatch: '#a7a7a2' },
  { id: 'custom', label: '色', swatch: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' },
  { id: 'image', label: '画像', swatch: '#ddd' },
];

const SERIF = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
const SANS = '"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number) {
  let s = 5;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  st: StudioSettings,
  img: HTMLImageElement | null,
): void {
  const lin = (a: string, b: string) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  switch (st.bg) {
    case 'mint':
      lin('#e3f0e7', '#b5d4c2');
      break;
    case 'dusk':
      lin('#f7cfae', '#8e7cb6');
      break;
    case 'night': {
      lin('#2a3242', '#0d1118');
      let s = 9;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        ctx.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5);
      }
      break;
    }
    case 'greenhouse': {
      lin('#e6f2f4', '#a9c8b0');
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(2, w / 160);
      const cols = 5;
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo((i / cols) * w, 0);
        ctx.lineTo((i / cols) * w, h * 0.7);
        ctx.stroke();
      }
      for (let y = h * 0.12; y < h * 0.7; y += h * 0.15) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = '#8f7a63';
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, h * 0.7, w, h * 0.02);
      break;
    }
    case 'concrete':
      ctx.fillStyle = '#a7a7a2';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, (w * h) / 60, 0.08);
      break;
    case 'custom':
      ctx.fillStyle = st.bgColor;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'image':
      ctx.fillStyle = '#ddd';
      ctx.fillRect(0, 0, w, h);
      if (img) {
        const s = Math.max(w / img.width, h / img.height);
        const iw = img.width * s;
        const ih = img.height * s;
        ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      }
      break;
    default:
      ctx.fillStyle = '#efe8da';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, (w * h) / 90, 0.035);
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function formatDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 図鑑カード画像を生成 */
export function renderCard(stage: Stage, p: SavedPlant, bgImg: HTMLImageElement | null): HTMLCanvasElement {
  const st = p.studio;
  const W = 1080;
  const H = st.aspect === '9:16' ? 1920 : 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  drawBackground(ctx, W, H, st, bgImg);

  const info = st.showInfo;
  const panelH = info ? (st.frame === 'minimal' ? 250 : 330) : 0;
  const pad = st.frame === 'specimen' ? 48 : 0;
  const shotH = H - panelH - pad;
  const shot = stage.snapshot(W, shotH);
  ctx.drawImage(shot, 0, pad * 0.5);

  const sp = SPECIES[p.speciesId];
  const ri = RARITY_INFO[p.rarity];
  const stars = '★'.repeat(ri.stars) + '☆'.repeat(4 - ri.stars);

  if (st.frame === 'specimen') {
    // 枠線
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    if (info) {
      const x = 70;
      const y = H - panelH - 10;
      const w = W - 140;
      const h = panelH - 50;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#fbf8f1';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = '#3b3329';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      ctx.fillStyle = '#3b3329';
      ctx.font = `600 22px ${SANS}`;
      ctx.fillText(`BOTANICAL ODDITIES ─ SPECIMEN No. ${seedCode(p.seed)}`, x + 34, y + 50);
      ctx.fillStyle = ri.color;
      ctx.textAlign = 'right';
      ctx.font = `30px ${SANS}`;
      ctx.fillText(stars, x + w - 34, y + 52);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1f1a14';
      ctx.font = `700 60px ${SERIF}`;
      ctx.fillText(p.name, x + 34, y + 125);
      ctx.font = `italic 30px Georgia,${SERIF}`;
      ctx.fillStyle = '#4d4336';
      ctx.fillText(`${sp.latin}  ─ ${sp.name}`, x + 34, y + 172);
      ctx.font = `24px ${SANS}`;
      const tags = p.tags.map((t) => `#${t}`).join('  ');
      ctx.fillText(tags, x + 34, y + 215);
      ctx.fillStyle = '#6b604f';
      ctx.font = `22px ${SANS}`;
      const cap = st.caption ? `「${st.caption}」  ` : '';
      const lines = wrapText(ctx, `${cap}採集日 ${formatDate(p.createdAt)}  ${ri.label}`, w - 68);
      lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x + 34, y + 252 + i * 28));
    }
  } else if (st.frame === 'dark') {
    if (info) {
      const y = H - panelH;
      const g = ctx.createLinearGradient(0, y - 80, 0, H);
      g.addColorStop(0, 'rgba(14,16,20,0)');
      g.addColorStop(0.25, 'rgba(14,16,20,0.92)');
      g.addColorStop(1, 'rgba(14,16,20,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 80, W, panelH + 80);
      ctx.fillStyle = '#d8b56a';
      ctx.font = `600 24px ${SANS}`;
      ctx.fillText(`${stars}  ${ri.label}   No.${seedCode(p.seed)}`, 70, y + 30);
      ctx.fillStyle = '#f5efe2';
      ctx.font = `700 72px ${SERIF}`;
      ctx.fillText(p.name, 70, y + 120);
      ctx.font = `italic 30px Georgia,${SERIF}`;
      ctx.fillStyle = '#bfb6a5';
      ctx.fillText(`${sp.latin} / ${sp.name}`, 70, y + 170);
      ctx.font = `24px ${SANS}`;
      ctx.fillText(p.tags.map((t) => `#${t}`).join('  '), 70, y + 215);
      if (st.caption) {
        ctx.fillStyle = '#e8e2d4';
        ctx.fillText(wrapText(ctx, st.caption, W - 140)[0], 70, y + 258);
      }
    }
  } else {
    if (info) {
      const y = H - panelH;
      ctx.fillStyle = '#1f2a24';
      ctx.font = `700 64px ${SERIF}`;
      ctx.fillText(p.name, 70, y + 90);
      ctx.font = `26px ${SANS}`;
      ctx.fillStyle = 'rgba(31,42,36,0.75)';
      ctx.fillText(`${sp.name} · ${ri.label} · No.${seedCode(p.seed)}`, 70, y + 138);
      ctx.fillText(p.tags.map((t) => `#${t}`).join(' '), 70, y + 178);
      if (st.caption) {
        ctx.font = `28px ${SERIF}`;
        ctx.fillText(wrapText(ctx, st.caption, W - 140)[0], 70, y + 222);
      }
    }
  }
  // 透かし
  ctx.fillStyle = st.frame === 'dark' || st.bg === 'night' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
  ctx.font = `18px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText('#BotanicalOddities', W - 56, st.frame === 'specimen' ? 64 : 40);
  ctx.textAlign = 'left';
  return c;
}

/** PNG を共有（Web Share API）または保存 */
export async function shareOrDownload(canvas: HTMLCanvasElement, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG生成に失敗'))), 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // 失敗したらダウンロードへフォールバック
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
