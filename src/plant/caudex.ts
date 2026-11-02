import type { SkCaudex, V3 } from './types';
import { clamp, smoothstep } from './vec';

/** 塊根の縦断面形状（高さ割合 h → 半径の倍率） */
export function caudexShape(c: SkCaudex, h: number): number {
  const shape = c.shape ?? 'bottle';
  if (shape === 'ball') {
    const base = Math.sqrt(Math.max(0, 1 - ((h - 0.45) / 0.62) ** 2));
    return Math.max(c.neck, base) * (0.9 + 0.1 * smoothstep(0, 0.1, h));
  }
  if (shape === 'dome') {
    const base = Math.sqrt(Math.max(0, 1 - Math.pow(h, 1.6) * 0.97));
    return Math.max(c.neck * 0.8, base) * (0.93 + 0.07 * smoothstep(0, 0.08, h));
  }
  const bottom = 0.86 + 0.14 * smoothstep(0, 0.15, h);
  const bul = 1 + c.bulge * Math.sin(Math.PI * Math.min(1, h * 1.25));
  const neck = 1 + (c.neck - 1) * Math.pow(smoothstep(0.25, 1, h), 1.1);
  return bottom * bul * neck;
}

/** 角度方向のこぶ・しわ */
export function caudexLobe(c: SkCaudex, th: number, h: number): number {
  let k = 1;
  for (const lb of c.lobes) k += lb.amp * Math.sin(lb.k * th + lb.phase + h * 1.7) * (0.35 + 0.65 * (1 - h));
  k += c.wrinkle * Math.sin(th * 17 + h * 25) * 0.4 * (1 - h);
  return k;
}

export function caudexY(c: SkCaudex, h: number): number {
  return (c.baseY ?? 0) - 0.05 + h * (c.height + 0.05);
}

/** 塊根表面の点（最終形） */
export function caudexPoint(c: SkCaudex, h: number, th: number): V3 {
  const y = caudexY(c, h);
  const r = c.radius * caudexShape(c, h) * caudexLobe(c, th, h);
  const lean = Math.pow(clamp((y - (c.baseY ?? 0)) / c.height), 1.5);
  return [c.leanX * lean + Math.cos(th) * r, y, c.leanZ * lean + Math.sin(th) * r];
}
