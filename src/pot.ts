import * as THREE from 'three';

export type PotShape = 'round' | 'tall' | 'bowl';
export type PotPattern = 'none' | 'stripe' | 'dot' | 'check' | 'wave';
export type PotWrap = 'none' | 'kraft' | 'news' | 'linen';

export interface Sticker {
  e: string;
  x: number; // 0..1
  y: number; // 0..1
  s: number; // 0..1 (高さ比)
}

export interface PotDeco {
  shape: PotShape;
  color: string;
  pattern: PotPattern;
  patternColor: string;
  wrap: PotWrap;
  glossy: boolean;
  doodle: string | null; // dataURL（透明PNG）
  stickers: Sticker[];
}

export const DEFAULT_DECO: PotDeco = {
  shape: 'round',
  color: '#c96f4a',
  pattern: 'none',
  patternColor: '#f3e9dc',
  wrap: 'none',
  glossy: false,
  doodle: null,
  stickers: [],
};

export const POT_SHAPES: { id: PotShape; label: string }[] = [
  { id: 'round', label: '丸鉢' },
  { id: 'tall', label: '筒鉢' },
  { id: 'bowl', label: '浅鉢' },
];

export const TEX_W = 1024;
export const TEX_H = 256;

interface Profile {
  outer: [number, number][]; // [r, y]（下→上）
  innerR: number; // 用土面の半径
  height: number;
}

function profile(shape: PotShape): Profile {
  if (shape === 'tall') {
    return {
      outer: [
        [0.36, -0.85],
        [0.385, -0.6],
        [0.41, -0.2],
        [0.42, -0.06],
        [0.445, -0.05],
        [0.445, 0.02],
      ],
      innerR: 0.4,
      height: 0.87,
    };
  }
  if (shape === 'bowl') {
    return {
      outer: [
        [0.5, -0.32],
        [0.58, -0.28],
        [0.66, -0.16],
        [0.7, -0.04],
        [0.72, 0.0],
        [0.72, 0.02],
      ],
      innerR: 0.67,
      height: 0.34,
    };
  }
  return {
    outer: [
      [0.34, -0.62],
      [0.44, -0.55],
      [0.53, -0.4],
      [0.56, -0.22],
      [0.54, -0.08],
      [0.57, -0.06],
      [0.58, 0.02],
    ],
    innerR: 0.52,
    height: 0.64,
  };
}

/** 鉢の表面テクスチャ（展開図）を描く */
export function drawPotTexture(ctx: CanvasRenderingContext2D, deco: PotDeco, doodle?: HTMLImageElement | HTMLCanvasElement | null): void {
  const w = TEX_W;
  const h = TEX_H;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = deco.color;
  ctx.fillRect(0, 0, w, h);
  // 素焼きっぽいムラ
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // 大きな色ムラはごく淡く、ぼかしたグラデーションで
  for (let i = 0; i < 14; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 40 + r() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() < 0.5 ? '255,255,255' : '0,0,0';
    g.addColorStop(0, `rgba(${c},0.05)`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // 細かい土の粒
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  // 轆轤（ろくろ）目
  ctx.strokeStyle = 'rgba(0,0,0,0.035)';
  ctx.lineWidth = 2;
  for (let y = 8; y < h; y += 14 + r() * 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (r() - 0.5) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = deco.patternColor;
  ctx.strokeStyle = deco.patternColor;
  switch (deco.pattern) {
    case 'stripe':
      for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 22, h);
      break;
    case 'dot':
      for (let y = 24; y < h; y += 48)
        for (let x = (y / 48) % 2 ? 24 : 48; x < w; x += 48) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    case 'check':
      ctx.globalAlpha = 0.55;
      for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 32, h);
      for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 32);
      ctx.globalAlpha = 1;
      break;
    case 'wave':
      ctx.lineWidth = 10;
      for (let y = 40; y < h; y += 60) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin((x / w) * Math.PI * 16) * 14);
        ctx.stroke();
      }
      break;
  }
  // ラッピング（鉢の中段に巻く）
  if (deco.wrap !== 'none') {
    const y0 = h * 0.28;
    const hh = h * 0.5;
    if (deco.wrap === 'kraft') {
      ctx.fillStyle = '#b98d5b';
      ctx.fillRect(0, y0, w, hh);
      for (let i = 0; i < 1600; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.15)' : 'rgba(255,240,210,0.12)';
        ctx.fillRect(r() * w, y0 + r() * hh, 1 + r() * 3, 1);
      }
      ctx.fillStyle = '#7c4f2c';
      ctx.fillRect(0, y0 + hh * 0.42, w, hh * 0.16);
    } else if (deco.wrap === 'news') {
      ctx.fillStyle = '#ecebe4';
      ctx.fillRect(0, y0, w, hh);
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      for (let col = 0; col < w; col += 70) {
        for (let y = y0 + 10; y < y0 + hh - 6; y += 8) {
          ctx.fillRect(col + 6, y, 40 + r() * 20, 3);
        }
      }
      ctx.fillStyle = 'rgba(20,20,20,0.85)';
      ctx.font = 'bold 26px serif';
      for (let x = 10; x < w; x += 260) ctx.fillText('BOTANICAL TIMES', x, y0 + 30);
    } else {
      ctx.fillStyle = '#e4dccb';
      ctx.fillRect(0, y0, w, hh);
      ctx.strokeStyle = 'rgba(120,100,70,0.18)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + hh);
        ctx.stroke();
      }
      for (let y = y0; y < y0 + hh; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, y0, w + 4, hh);
  }
  if (doodle) ctx.drawImage(doodle, 0, 0, w, h);
  for (const st of deco.stickers) {
    const size = st.s * h;
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.e, st.x * w, st.y * h);
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

export class Pot extends THREE.Group {
  deco: PotDeco;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private wallMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private body = new THREE.Group();
  private doodleImg: HTMLImageElement | null = null;
  /** 非同期のテクスチャ更新完了時など */
  onChange?: () => void;
  scaleFactor = 1;
  innerR = 0.5;
  potHeight = 0.6;
  private avoidR = 0;

  constructor(deco: PotDeco, avoidRadius = 0) {
    super();
    this.deco = { ...deco, stickers: [...deco.stickers] };
    this.avoidR = avoidRadius;
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX_W;
    this.canvas.height = TEX_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.wallMat = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85 });
    this.rimMat = new THREE.MeshStandardMaterial({ color: deco.color, roughness: 0.85 });
    this.add(this.body);
    this.fit();
    this.build();
    this.setDeco(this.deco);
  }

  /** 植物の大きさに合わせて鉢を拡大 */
  private fit(): void {
    const p = profile(this.deco.shape);
    this.scaleFactor = Math.max(1, (this.avoidR * 1.3) / p.innerR);
    this.body.scale.setScalar(this.scaleFactor);
    this.innerR = p.innerR * this.scaleFactor;
    this.potHeight = p.height * this.scaleFactor;
  }

  private build(): void {
    for (const c of [...this.body.children]) {
      this.body.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    const p = profile(this.deco.shape);
    const pts = p.outer.map(([r, y]) => new THREE.Vector2(r, y));
    const wall = new THREE.LatheGeometry(pts, 56);
    // UV の v を高さに合わせて正規化
    const uv = wall.getAttribute('uv') as THREE.BufferAttribute;
    const pos = wall.getAttribute('position') as THREE.BufferAttribute;
    const y0 = p.outer[0][1];
    const y1 = p.outer[p.outer.length - 1][1];
    for (let i = 0; i < uv.count; i++) uv.setY(i, (pos.getY(i) - y0) / (y1 - y0));
    const wallMesh = new THREE.Mesh(wall, this.wallMat);
    // テクスチャ中央（u=0.5）を正面（+Z）に向ける
    wallMesh.rotation.y = Math.PI;
    this.body.add(wallMesh);

    // 縁・内側・底
    const top = p.outer[p.outer.length - 1];
    const rimPts = [
      new THREE.Vector2(top[0], top[1]),
      new THREE.Vector2(top[0] - 0.035, top[1] + 0.005),
      new THREE.Vector2(p.innerR + 0.01, -0.02),
      new THREE.Vector2(p.innerR, -0.12),
    ];
    const rim = new THREE.Mesh(new THREE.LatheGeometry(rimPts, 56), this.rimMat);
    this.body.add(rim);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(p.outer[0][0], 40), this.rimMat);
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = p.outer[0][1];
    this.body.add(bottom);

    // 用土
    const soilGeo = new THREE.CircleGeometry(p.innerR + 0.005, 48);
    soilGeo.rotateX(-Math.PI / 2);
    const soil = new THREE.Mesh(soilGeo, new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 1 }));
    soil.position.y = -0.035;
    this.body.add(soil);

    // 化粧砂利（インスタンス）
    const count = Math.round(260 * (p.innerR / 0.5) ** 2);
    const pg = new THREE.IcosahedronGeometry(0.02, 0);
    const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const pebbles = new THREE.InstancedMesh(pg, pm, count);
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const avoid = this.avoidR / Math.max(1, this.scaleFactor);
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * (p.innerR - 0.02);
      if (rad < avoid * 0.85) continue;
      e.set(r() * 6, r() * 6, r() * 6);
      q.setFromEuler(e);
      const sc = 0.5 + r() * 0.7;
      m.compose(new THREE.Vector3(Math.cos(a) * rad, -0.03, Math.sin(a) * rad), q, new THREE.Vector3(sc, sc * 0.7, sc));
      pebbles.setMatrixAt(placed, m);
      const v = 0.42 + r() * 0.3;
      col.setRGB(v, v * 0.95, v * 0.86);
      pebbles.setColorAt(placed, col);
      placed++;
    }
    pebbles.count = placed;
    this.body.add(pebbles);
  }

  setDeco(deco: PotDeco): void {
    const shapeChanged = deco.shape !== this.deco.shape;
    const doodleChanged = deco.doodle !== this.deco.doodle;
    this.deco = { ...deco, stickers: [...deco.stickers] };
    if (shapeChanged) {
      this.fit();
      this.build();
    }
    this.rimMat.color.set(deco.color);
    this.wallMat.roughness = deco.glossy ? 0.25 : 0.85;
    this.rimMat.roughness = deco.glossy ? 0.3 : 0.85;
    if (doodleChanged || (deco.doodle && !this.doodleImg)) {
      if (deco.doodle) {
        const img = new Image();
        img.onload = () => {
          this.doodleImg = img;
          this.redraw();
          this.onChange?.();
        };
        img.src = deco.doodle;
      } else this.doodleImg = null;
    }
    this.redraw();
  }

  /** ペイント中は直接キャンバスを渡して高速に反映 */
  redraw(liveDoodle?: HTMLCanvasElement | null): void {
    drawPotTexture(this.ctx, this.deco, liveDoodle ?? this.doodleImg);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    this.texture.dispose();
    this.wallMat.dispose();
    this.rimMat.dispose();
  }
}
