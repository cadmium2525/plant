import { Rng } from '../rng';
import type { Rarity } from './types';
import type { SpeciesDef } from './species';

/**
 * ガチャで見せる「種そのもの」の絵。
 * 形は種類ごと（綿毛つき・翼つき・小さな核果など）、色や向きは個体ごとに少し変わる。
 */
export function drawSeed(canvas: HTMLCanvasElement, def: SpeciesDef, seed: number, rarity: Rarity): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const rng = new Rng(seed).fork(7);
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;

  // レア度の後光
  if (rarity !== 'N') {
    const glow = { R: '91,155,213', SR: '181,122,216', SSR: '240,190,70' }[rarity];
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.48);
    gr.addColorStop(0, `rgba(${glow},0.45)`);
    gr.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    if (rarity === 'SSR' || rarity === 'SR') {
      ctx.strokeStyle = `rgba(${glow},0.6)`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * W * 0.2, cy + Math.sin(a) * W * 0.2);
        ctx.lineTo(cx + Math.cos(a) * W * 0.44, cy + Math.sin(a) * W * 0.44);
        ctx.stroke();
      }
    }
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rng.range(-0.5, 0.5));
  const s = (W / 360) * def.seed.size * 1.35;
  ctx.scale(s, s);
  const base = def.seed.color;
  const body = (len: number, wid: number) => {
    const g = ctx.createLinearGradient(-wid, -wid, wid, wid);
    g.addColorStop(0, shade(base, 1.25));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, 0.7));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(base, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    // 種皮のすじ
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-len * 0.75, -wid * 0.2);
    ctx.quadraticCurveTo(0, -wid * 0.55, len * 0.75, -wid * 0.2);
    ctx.stroke();
  };
  const tuft = (x: number, dir: number, len: number) => {
    ctx.strokeStyle = 'rgba(176,158,128,0.75)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = rng.range(-0.55, 0.55);
      const l = len * rng.range(0.7, 1.1);
      ctx.lineWidth = rng.range(0.8, 1.8);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + dir * l * 0.5, Math.sin(a) * l * 0.3, x + dir * Math.cos(a) * l, Math.sin(a) * l);
      ctx.stroke();
    }
  };

  switch (def.seed.kind) {
    case 'tuft2': {
      // 細長い種の両端に綿毛（アデニウム）
      tuft(-70, -1, 90);
      tuft(70, 1, 90);
      body(72, 11);
      break;
    }
    case 'tuft1': {
      // 片側だけに綿毛（パキポディウム）
      tuft(-55, -1, 120);
      body(58, 16);
      break;
    }
    case 'wing': {
      // 薄い翼に囲まれた種（亀甲竜・ブージャム）
      const wl = rng.range(95, 115);
      const ww = rng.range(55, 70);
      ctx.fillStyle = 'rgba(232,218,185,0.85)';
      ctx.strokeStyle = shade(base, 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-wl, 0);
      ctx.bezierCurveTo(-wl * 0.6, -ww * 1.2, wl * 0.6, -ww * 1.2, wl, 0);
      ctx.bezierCurveTo(wl * 0.6, ww * 1.1, -wl * 0.6, ww * 1.1, -wl, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150,120,80,0.35)';
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * 0.35) * wl * 0.9 * (i % 2 ? 1 : -1), Math.sin(i * 0.35) * ww * 0.9);
        ctx.stroke();
      }
      body(30, 22);
      break;
    }
    case 'fig': {
      // イチジク状の小さな実（中に細かい種）
      body(46, 40);
      ctx.fillStyle = 'rgba(255,235,200,0.55)';
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc(rng.range(-28, 28), rng.range(-22, 22), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shade(base, 0.45);
      ctx.beginPath();
      ctx.arc(44, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      // 小さな核果（デカリア・オペルクリカリア）
      body(38, 30);
      ctx.fillStyle = shade(base, 0.5);
      ctx.beginPath();
      ctx.arc(36, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
