import type { Skeleton } from './types';

/** 最終樹形を横から見たシルエットを描く（ガチャの予告用） */
export function drawSilhouette(canvas: HTMLCanvasElement, sk: Skeleton, color = '#1f2a24'): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const span = Math.max(sk.height + 0.1, sk.width * 2.2);
  const s = (Math.min(W, H) * 0.9) / span;
  const ox = W / 2;
  const oy = H * 0.94;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy - y * s;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const c = sk.caudex;
  if (c) {
    ctx.beginPath();
    const steps = 24;
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const hh = i / steps;
      const bul = 1 + c.bulge * Math.sin(Math.PI * Math.min(1, hh * 1.25));
      const neck = 1 + (c.neck - 1) * Math.pow(Math.min(1, Math.max(0, (hh - 0.25) / 0.75)), 1.1);
      pts.push([c.radius * bul * neck, hh * c.height]);
    }
    const lean = (y: number) => c.leanX * Math.pow(y / c.height, 1.5);
    ctx.moveTo(X(lean(0) - pts[0][0]), Y(0));
    for (const [r, y] of pts) ctx.lineTo(X(lean(y) - r), Y(y));
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(X(lean(pts[i][1]) + pts[i][0]), Y(pts[i][1]));
    ctx.closePath();
    ctx.fill();
  }
  for (const b of sk.branches) {
    for (let k = 1; k < b.nodes.length; k++) {
      const a = b.nodes[k - 1];
      const d = b.nodes[k];
      ctx.lineWidth = Math.max(1.2, (a.r + d.r) * s);
      ctx.beginPath();
      ctx.moveTo(X(a.p[0]), Y(a.p[1]));
      ctx.lineTo(X(d.p[0]), Y(d.p[1]));
      ctx.stroke();
    }
  }
  ctx.fillRect(ox - W * 0.3, oy, W * 0.6, 3);
}
