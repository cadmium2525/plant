import * as THREE from 'three';
import type { Specimen, SkBranch, V3 } from './types';
import { SPECIES } from './species';
import { clamp, cross, easeOut, norm, perpendicular, smoothstep } from './vec';

/* ------------------------------------------------------------------ */
/* 共有テクスチャ・ジオメトリ                                            */
/* ------------------------------------------------------------------ */

const texCache = new Map<string, THREE.Texture>();

function barkTexture(kind: 'smooth' | 'rough'): THREE.Texture {
  const key = 'bark-' + kind;
  const hit = texCache.get(key);
  if (hit) return hit;
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, w, h);
  // 擬似乱数（テクスチャは全個体共通なので固定）
  let s = kind === 'smooth' ? 7 : 13;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (kind === 'smooth') {
    // アデニウム: なめらかな肌 + 横向きの皮目
    for (let i = 0; i < 900; i++) {
      const v = 200 + r() * 55;
      g.fillStyle = `rgba(${v},${v},${v},0.25)`;
      g.fillRect(r() * w, r() * h, 2 + r() * 8, 2 + r() * 6);
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = 'rgba(150,140,130,0.35)';
      const x = r() * w;
      const y = r() * h;
      g.fillRect(x, y, 3 + r() * 6, 1);
    }
  } else {
    // デカリア: 縦の筋と粗い樹皮
    for (let i = 0; i < 120; i++) {
      const v = 140 + r() * 90;
      g.strokeStyle = `rgba(${v},${v},${v},0.45)`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      let x = r() * w;
      let y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 4;
        y += 6 + r() * 10;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      const v = 120 + r() * 120;
      g.fillStyle = `rgba(${v},${v},${v},0.3)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function flowerTexture(h: number, s: number, l: number, pattern: string): THREE.Texture {
  const key = `fl-${h.toFixed(3)}-${s}-${l}-${pattern}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const col = new THREE.Color().setHSL(h, s, l);
  const dark = new THREE.Color().setHSL(h, Math.min(1, s * 1.1), l * 0.75);
  const css = (k: THREE.Color) => `#${k.getHexString()}`;
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  const inner = pattern === 'edge' ? 0.45 : 0.2;
  grad.addColorStop(0, '#fff6c8');
  grad.addColorStop(0.08, '#fffaf0');
  grad.addColorStop(inner, s < 0.1 ? '#ffffff' : '#fff0f4');
  grad.addColorStop(Math.min(0.95, inner + 0.2), css(col));
  grad.addColorStop(1, css(dark));
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);
  // のど部分の筋
  g.strokeStyle = s < 0.1 ? 'rgba(255,190,200,0.6)' : css(dark);
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    g.beginPath();
    g.moveTo(n / 2, n / 2);
    g.lineTo(n / 2 + Math.cos(a) * n * 0.2, n / 2 + Math.sin(a) * n * 0.2);
    g.stroke();
  }
  if (pattern === 'stripe') {
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      g.lineWidth = 2 + (i % 3);
      g.beginPath();
      g.moveTo(n / 2 + Math.cos(a) * n * 0.15, n / 2 + Math.sin(a) * n * 0.15);
      g.lineTo(n / 2 + Math.cos(a) * n * 0.5, n / 2 + Math.sin(a) * n * 0.5);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** 葉: +Y 方向に長さ 1、幅は X、Z は表側 */
function leafGeometry(kind: 'obovate' | 'round'): THREE.BufferGeometry {
  const U = 8;
  const V = 4;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const W = kind === 'obovate' ? 0.46 : 0.8;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    let wv: number;
    if (kind === 'obovate') wv = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.85);
    else wv = Math.pow(Math.sin(Math.PI * u), 0.7);
    const petiole = kind === 'obovate' ? 0.08 : 0.15;
    if (u < petiole) wv *= 0.25;
    for (let j = 0; j <= V; j++) {
      const v = (j / V) * 2 - 1;
      const x = v * wv * W * 0.5;
      const y = u;
      const z = Math.abs(v) * wv * 0.08 - u * u * (kind === 'obovate' ? 0.22 : 0.12);
      pos.push(x, y, z);
      uv.push(j / V, u);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 花: +Y 方向に開くラッパ形（5弁） */
function flowerGeometry(): THREE.BufferGeometry {
  const A = 40;
  const S = 7;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= A; i++) {
    const th = (i / A) * Math.PI * 2;
    // 5弁のフチ形状（少しねじれた風車状）
    const lobe = 0.45 + 0.55 * Math.pow(Math.abs(Math.cos((5 * th) / 2 + 0.3)), 0.55);
    for (let j = 0; j <= S; j++) {
      const s = j / S;
      const rad = s < 0.3 ? 0.06 + s * 0.25 : 0.135 + (s - 0.3) * 1.25 * lobe;
      const y = s < 0.3 ? s * 1.2 : 0.36 + (s - 0.3) * 0.25 - Math.pow(s, 3) * 0.08;
      pos.push(Math.cos(th) * rad, y, Math.sin(th) * rad);
      const tr = Math.min(1, s) * 0.5;
      uv.push(0.5 + Math.cos(th) * tr, 0.5 + Math.sin(th) * tr);
    }
  }
  for (let i = 0; i < A; i++)
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j;
      const b = a + S + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const hsl = (a: [number, number, number], dh = 0) => new THREE.Color().setHSL(a[0] + dh, a[1], a[2]);

/* ------------------------------------------------------------------ */
/* 植物モデル                                                           */
/* ------------------------------------------------------------------ */

interface BranchCache {
  b: SkBranch;
  offset: number; // 頂点 offset
  frames: { n: V3; bi: V3 }[];
  pos: V3[]; // 描画用に平滑化したノード位置（太い部分のカクつきを抑える）
}

export class PlantModel extends THREE.Group {
  readonly specimen: Specimen;
  private sides: number;
  private branchGeo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private branchCaches: BranchCache[] = [];
  private caudexMesh: THREE.Mesh | null = null;
  private leaves: THREE.InstancedMesh | null = null;
  private flowers: THREE.InstancedMesh | null = null;
  private spines: THREE.InstancedMesh | null = null;
  private leafQuat: THREE.Quaternion[] = [];
  private flowerQuat: THREE.Quaternion[] = [];
  private spineQuat: THREE.Quaternion[] = [];
  private young: THREE.Color;
  private old: THREE.Color;
  private leafBase: THREE.Color;
  private leafVar: THREE.Color;
  private lastT = -1;

  constructor(specimen: Specimen, quality: 'low' | 'mid' | 'high' = 'mid') {
    super();
    this.specimen = specimen;
    const sk = specimen.skeleton;
    const def = SPECIES[specimen.speciesId];
    const isAd = specimen.speciesId === 'adenium';
    this.sides = quality === 'low' ? 6 : isAd ? 10 : 8;
    const dh = specimen.genes.barkHue;
    this.young = hsl(def.barkYoung, dh);
    this.old = hsl(def.barkOld, dh);
    this.leafBase = hsl(def.leafColor);
    this.leafVar = new THREE.Color('#e9e7b8');

    /* --- 枝（1つのジオメトリにまとめる） --- */
    const S = this.sides;
    let vcount = 0;
    for (const b of sk.branches) {
      const frames: { n: V3; bi: V3 }[] = [];
      const pos = b.nodes.map((nd, k) => {
        if (k === 0 || k === b.nodes.length - 1) return nd.p;
        const a = b.nodes[k - 1].p;
        const c = b.nodes[k + 1].p;
        const seg = (dist3(a, nd.p) + dist3(c, nd.p)) / 2;
        const w = clamp(nd.r / Math.max(1e-4, seg)) * 0.7;
        const mid: V3 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
        return lerp(nd.p, mid, w);
      });
      let n = perpendicular(norm(sub3(b.nodes[1].p, b.nodes[0].p)));
      for (let k = 0; k < b.nodes.length; k++) {
        const a = pos[Math.max(0, k - 1)];
        const c = pos[Math.min(b.nodes.length - 1, k + 1)];
        const T = norm(sub3(c, a));
        // 平行移動フレーム
        n = norm(cross(cross(T, n), T));
        frames.push({ n, bi: norm(cross(T, n)) });
      }
      this.branchCaches.push({ b, offset: vcount, frames, pos });
      vcount += b.nodes.length * (S + 1);
    }
    const positions = new Float32Array(vcount * 3);
    const normals = new Float32Array(vcount * 3);
    const colors = new Float32Array(vcount * 3);
    const uvs = new Float32Array(vcount * 2);
    const index: number[] = [];
    for (const bc of this.branchCaches) {
      let along = 0;
      bc.b.nodes.forEach((nd, k) => {
        if (k > 0) along += dist3(nd.p, bc.b.nodes[k - 1].p);
        const f = bc.frames[k];
        for (let j = 0; j <= S; j++) {
          const th = (j / S) * Math.PI * 2;
          const c = Math.cos(th);
          const s = Math.sin(th);
          const vi = bc.offset + k * (S + 1) + j;
          normals[vi * 3] = f.n[0] * c + f.bi[0] * s;
          normals[vi * 3 + 1] = f.n[1] * c + f.bi[1] * s;
          normals[vi * 3 + 2] = f.n[2] * c + f.bi[2] * s;
          uvs[vi * 2] = j / S;
          uvs[vi * 2 + 1] = along * (isAd ? 1.5 : 3) / Math.max(0.3, nd.r * 12);
        }
        if (k < bc.b.nodes.length - 1)
          for (let j = 0; j < S; j++) {
            const a = bc.offset + k * (S + 1) + j;
            const b2 = a + S + 1;
            index.push(a, a + 1, b2, b2, a + 1, b2 + 1);
          }
      });
    }
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('color', this.colAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    this.branchGeo = geo;
    const barkMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: barkTexture(isAd ? 'smooth' : 'rough'),
      roughness: isAd ? 0.62 : 0.85,
      metalness: 0,
    });
    const bm = new THREE.Mesh(geo, barkMat);
    bm.frustumCulled = false;
    this.add(bm);

    /* --- 塊根 --- */
    if (sk.caudex) this.caudexMesh = this.buildCaudex(isAd);

    /* --- 葉 --- */
    if (sk.leaves.length) {
      const lg = leafGeometry(isAd ? 'obovate' : 'round');
      const lm = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: isAd ? 0.38 : 0.6,
        side: THREE.DoubleSide,
      });
      this.leaves = new THREE.InstancedMesh(lg, lm, sk.leaves.length);
      this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.leaves.frustumCulled = false;
      const tmp = new THREE.Color();
      sk.leaves.forEach((lf, i) => {
        this.leafQuat.push(basisQuat(lf.dir, lf.side));
        tmp.copy(lf.variegated ? this.leafVar : this.leafBase);
        tmp.offsetHSL(((i * 37) % 11) / 400 - 0.012, 0, ((i * 53) % 13) / 260 - 0.025);
        this.leaves!.setColorAt(i, tmp);
      });
      this.add(this.leaves);
    }

    /* --- 花 --- */
    if (sk.flowers.length) {
      const g = specimen.genes;
      const fm = new THREE.MeshStandardMaterial({
        map: flowerTexture(g.flowerHue, g.flowerSat, g.flowerLight, g.flowerPattern),
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      this.flowers = new THREE.InstancedMesh(flowerGeometry(), fm, sk.flowers.length);
      this.flowers.frustumCulled = false;
      sk.flowers.forEach((f) => this.flowerQuat.push(basisQuat(f.dir, perpendicular(f.dir))));
      this.add(this.flowers);
    }

    /* --- トゲ --- */
    if (sk.spines.length) {
      const sg = new THREE.ConeGeometry(0.09, 1, 4, 1);
      sg.translate(0, 0.5, 0);
      const sm = new THREE.MeshStandardMaterial({ color: hsl(def.barkOld).multiplyScalar(0.8), roughness: 0.7 });
      this.spines = new THREE.InstancedMesh(sg, sm, sk.spines.length);
      this.spines.frustumCulled = false;
      sk.spines.forEach((s) => this.spineQuat.push(basisQuat(s.dir, perpendicular(s.dir))));
      this.add(this.spines);
    }
    this.update(1);
  }

  private buildCaudex(isAd: boolean): THREE.Mesh {
    const c = this.specimen.skeleton.caudex!;
    const H = 30;
    const A = 44;
    const dome = 5;
    const pos: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const def = SPECIES[this.specimen.speciesId];
    const base = hsl(def.caudexColor, this.specimen.genes.barkHue);
    const dark = base.clone().multiplyScalar(0.7);
    const tmp = new THREE.Color();
    const rows = H + dome;
    for (let i = 0; i <= rows; i++) {
      let h: number;
      let y: number;
      let rr: number;
      if (i <= H) {
        h = i / H;
        y = -0.05 + h * (c.height + 0.05);
        const bottom = 0.86 + 0.14 * smoothstep(0, 0.15, h);
        const bul = 1 + c.bulge * Math.sin(Math.PI * Math.min(1, h * 1.25));
        const neck = 1 + (c.neck - 1) * Math.pow(smoothstep(0.25, 1, h), 1.1);
        rr = c.radius * bottom * bul * neck;
      } else {
        const d = (i - H) / dome;
        h = 1;
        y = c.height + Math.sin((d * Math.PI) / 2) * c.radius * c.neck * 0.45;
        rr = c.radius * c.neck * Math.cos((d * Math.PI) / 2);
      }
      const lean = Math.pow(clamp(y / c.height), 1.5);
      const cx = c.leanX * lean;
      const cz = c.leanZ * lean;
      for (let j = 0; j <= A; j++) {
        const th = (j / A) * Math.PI * 2;
        let k = 1;
        for (const lb of c.lobes) k += lb.amp * Math.sin(lb.k * th + lb.phase + h * 1.7) * (0.35 + 0.65 * (1 - h));
        k += c.wrinkle * Math.sin(th * 17 + h * 25) * 0.4 * (1 - h);
        const r = rr * k;
        pos.push(cx + Math.cos(th) * r, y, cz + Math.sin(th) * r);
        uv.push((j / A) * (isAd ? 3 : 2), (y / Math.max(0.2, c.height)) * 1.2);
        tmp.copy(dark).lerp(base, smoothstep(-0.02, 0.18, y));
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < A; j++) {
        const a = i * (A + 1) + j;
        const b = a + A + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const tex = barkTexture(isAd ? 'smooth' : 'rough');
    const m = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: isAd ? 0.55 : 0.85 });
    const mesh = new THREE.Mesh(g, m);
    this.add(mesh);
    return mesh;
  }

  /** 正規化時間 t (0..1) の姿に更新 */
  update(t: number): void {
    t = clamp(t, 0, 1);
    if (Math.abs(t - this.lastT) < 1e-5) return;
    this.lastT = t;
    const sk = this.specimen.skeleton;
    const S = this.sides;
    const P = this.posAttr.array as Float32Array;
    const C = this.colAttr.array as Float32Array;
    const N = this.branchGeo.getAttribute('normal').array as Float32Array;
    const tmp = new THREE.Color();
    const isAd = this.specimen.speciesId === 'adenium';
    const tipR = isAd ? 0.016 : 0.006;

    for (const bc of this.branchCaches) {
      const nodes = bc.b.nodes;
      const P0 = bc.pos;
      // 成長点を探す
      let tip: V3 = P0[0];
      const visible = t >= nodes[0].t;
      let grownK = -1;
      for (let k = 0; k < nodes.length; k++) {
        if (t >= nodes[k].t) {
          grownK = k;
          tip = P0[k];
        } else {
          if (k > 0) {
            const f = (t - nodes[k - 1].t) / Math.max(1e-6, nodes[k].t - nodes[k - 1].t);
            tip = lerp(P0[k - 1], P0[k], clamp(f));
          }
          break;
        }
      }
      for (let k = 0; k < nodes.length; k++) {
        const nd = nodes[k];
        let p: V3;
        let r: number;
        let age = 0;
        if (!visible) {
          p = P0[0];
          r = 0;
        } else if (k <= grownK) {
          p = P0[k];
          age = t - nd.t;
          const thick = 0.25 + 0.75 * easeOut(age / Math.max(0.12, 1 - nd.t));
          const young = k >= grownK - 1 && grownK < nodes.length - 1 ? tipR : 0;
          r = Math.min(nd.r, Math.max(nd.r * thick, young));
          if (bc.b.root) r = nd.r * easeOut(age / 0.3);
        } else if (k === grownK + 1) {
          p = tip;
          r = Math.min(nd.r, tipR * 0.6);
        } else {
          p = tip;
          r = 0;
        }
        tmp.copy(this.young).lerp(this.old, clamp(age / 0.3));
        for (let j = 0; j <= S; j++) {
          const vi = bc.offset + k * (S + 1) + j;
          P[vi * 3] = p[0] + N[vi * 3] * r;
          P[vi * 3 + 1] = p[1] + N[vi * 3 + 1] * r;
          P[vi * 3 + 2] = p[2] + N[vi * 3 + 2] * r;
          C[vi * 3] = tmp.r;
          C[vi * 3 + 1] = tmp.g;
          C[vi * 3 + 2] = tmp.b;
        }
      }
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;

    /* 塊根: 高さは前半で、太りは後半まで続く */
    if (this.caudexMesh) {
      const sh = 0.15 + 0.85 * easeOut(t / 0.3);
      const sr = 0.2 + 0.8 * easeOut(t / 0.8);
      this.caudexMesh.scale.set(sr, sh, sr);
    }

    const m = new THREE.Matrix4();
    const sc = new THREE.Vector3();
    const ps = new THREE.Vector3();
    if (this.leaves) {
      const yellow = new THREE.Color('#d8b94a');
      let colorDirty = false;
      sk.leaves.forEach((lf, i) => {
        let s = easeOutBack(clamp((t - lf.t) / 0.07));
        if (t > lf.shed) s *= 1 - clamp((t - lf.shed) / 0.06);
        const nd = sk.branches[lf.b].nodes[lf.n];
        const np = this.branchCaches[lf.b].pos[lf.n];
        ps.set(np[0] + lf.dir[0] * nd.r * 0.6, np[1] + lf.dir[1] * nd.r * 0.6, np[2] + lf.dir[2] * nd.r * 0.6);
        const sz = lf.size * Math.max(0, s);
        sc.set(sz, sz, sz);
        m.compose(ps, this.leafQuat[i], sc);
        this.leaves!.setMatrixAt(i, m);
        if (lf.shed < 1.5) {
          tmp.copy(lf.variegated ? this.leafVar : this.leafBase).lerp(yellow, clamp((t - lf.shed + 0.08) / 0.08));
          this.leaves!.setColorAt(i, tmp);
          colorDirty = true;
        }
      });
      this.leaves.instanceMatrix.needsUpdate = true;
      if (colorDirty && this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
    }
    if (this.flowers) {
      sk.flowers.forEach((f, i) => {
        const s = easeOutBack(clamp((t - f.t) / 0.06));
        const np = this.branchCaches[f.b].pos[f.n];
        ps.set(np[0], np[1], np[2]);
        const sz = f.size * s;
        sc.set(sz, sz, sz);
        m.compose(ps, this.flowerQuat[i], sc);
        this.flowers!.setMatrixAt(i, m);
      });
      this.flowers.instanceMatrix.needsUpdate = true;
    }
    if (this.spines) {
      sk.spines.forEach((sp, i) => {
        const s = clamp((t - sp.t) / 0.05);
        const nd = sk.branches[sp.b].nodes[sp.n];
        const np = this.branchCaches[sp.b].pos[sp.n];
        ps.set(np[0] + sp.dir[0] * nd.r * 0.8, np[1] + sp.dir[1] * nd.r * 0.8, np[2] + sp.dir[2] * nd.r * 0.8);
        sc.set(sp.len * s, sp.len * s, sp.len * s);
        m.compose(ps, this.spineQuat[i], sc);
        this.spines!.setMatrixAt(i, m);
      });
      this.spines.instanceMatrix.needsUpdate = true;
    }
  }

  /** 時刻 t における見た目の高さ（カメラ追従用） */
  heightAt(t: number): number {
    const sk = this.specimen.skeleton;
    let h = sk.caudex ? sk.caudex.height * (0.15 + 0.85 * easeOut(t / 0.3)) : 0.1;
    for (const b of sk.branches) for (const nd of b.nodes) if (nd.t <= t) h = Math.max(h, nd.p[1]);
    return h;
  }

  dispose(): void {
    this.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
  }
}

function easeOutBack(x: number): number {
  if (x <= 0) return 0;
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function sub3(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dist3(a: V3, b: V3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
function lerp(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function basisQuat(dir: V3, side: V3): THREE.Quaternion {
  const y = new THREE.Vector3(...dir).normalize();
  let x = new THREE.Vector3(...side);
  x.sub(y.clone().multiplyScalar(x.dot(y)));
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3(...perpendicular(dir));
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
