import { Rng } from '../rng';
import type {
  Genes,
  GrowthEvent,
  SkBranch,
  SkCaudex,
  SkFlower,
  SkLeaf,
  SkSpine,
  Skeleton,
  SpeciesId,
  Specimen,
  V3,
} from './types';
import { add, clamp, cross, dot, norm, perpendicular, rotate, scale, sub } from './vec';
import { evaluateTraits } from './rarity';

/* ------------------------------------------------------------------ */
/* 遺伝パラメータ                                                       */
/* ------------------------------------------------------------------ */

const FLOWER_PALETTE: { h: number; s: number; l: number; w: number }[] = [
  { h: 0.95, s: 0.75, l: 0.62, w: 5 }, // ピンク
  { h: 0.99, s: 0.8, l: 0.5, w: 4 }, // 赤
  { h: 0.97, s: 0.7, l: 0.36, w: 2 }, // 深紅
  { h: 0.0, s: 0.05, l: 0.95, w: 2 }, // 白
  { h: 0.83, s: 0.45, l: 0.5, w: 1.2 }, // 紫
  { h: 0.12, s: 0.85, l: 0.62, w: 0.4 }, // 黄（希少）
];

function weighted<T extends { w: number }>(rng: Rng, items: T[]): T {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = rng.next() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function makeGenes(speciesId: SpeciesId, seed: number): Genes {
  const rng = new Rng(seed).fork(1);
  const dwarf = rng.chance(0.06);
  const fasciation = rng.chance(0.045);
  const variegated = rng.chance(0.06);
  const fl = weighted(rng, FLOWER_PALETTE);
  const flowerPattern: Genes['flowerPattern'] = rng.chance(0.07) ? 'stripe' : rng.chance(0.4) ? 'edge' : 'plain';

  if (speciesId === 'adenium') {
    const hr = rng.next();
    const heads = fasciation ? rng.int(4, 6) : hr < 0.42 ? 1 : hr < 0.72 ? 2 : hr < 0.89 ? 3 : rng.int(4, 6);
    const megaCaudex = rng.chance(0.08);
    return {
      heads,
      height: rng.range(0.8, 1.2) * (dwarf ? 0.55 : 1),
      thickness: rng.range(0.85, 1.3),
      caudex: megaCaudex ? rng.range(1.5, 1.8) : rng.range(0.8, 1.25),
      curvature: rng.range(0.08, 0.3),
      lean: rng.chance(0.1) ? rng.range(0.35, 0.55) : rng.range(0, 0.2),
      leanAngle: rng.range(0, Math.PI * 2),
      branchProb: rng.range(0.4, 0.65),
      branchAngle: rng.range(0.45, 0.8),
      internode: 0.075,
      zigzag: 0,
      twist: rng.chance(0.1) ? rng.range(0.25, 0.45) : rng.range(0, 0.12),
      leafDensity: rng.range(0.75, 1.2),
      leafSize: rng.range(0.85, 1.2),
      flowerAmount: rng.range(0.45, 1),
      flowerHue: fl.h,
      flowerSat: fl.s,
      flowerLight: fl.l,
      flowerPattern,
      spineDensity: 0,
      barkHue: rng.range(-0.02, 0.03),
      fasciation,
      variegated,
      dwarf,
    };
  }
  // decaryia
  const hr = rng.next();
  const heads = fasciation ? 1 : hr < 0.84 ? 1 : hr < 0.97 ? 2 : 3;
  const superZig = rng.chance(0.08);
  return {
    heads,
    height: rng.range(0.85, 1.25) * (dwarf ? 0.6 : 1),
    thickness: rng.range(0.75, 1.15),
    caudex: rng.chance(0.08) ? rng.range(1.35, 1.6) : rng.range(0.55, 1.0),
    curvature: rng.range(0.03, 0.1),
    lean: rng.chance(0.1) ? rng.range(0.3, 0.45) : rng.range(0, 0.15),
    leanAngle: rng.range(0, Math.PI * 2),
    branchProb: rng.range(0.32, 0.5),
    branchAngle: rng.range(0.7, 1.05),
    internode: 0.078,
    // 節ごとに左右へ大きく折れる（実物は節で直角近くまで曲がる）
    zigzag: superZig ? rng.range(0.95, 1.1) : rng.range(0.62, 0.85),
    // ねじれが強いと折れる面が回ってジグザグがぼやけるので控えめに
    twist: rng.chance(0.1) ? rng.range(0.12, 0.2) : rng.range(0, 0.03),
    leafDensity: rng.range(0.4, 0.65),
    leafSize: rng.range(0.85, 1.2),
    flowerAmount: 0,
    flowerHue: fl.h,
    flowerSat: fl.s,
    flowerLight: fl.l,
    flowerPattern: 'plain',
    spineDensity: rng.range(0.6, 1),
    barkHue: rng.range(-0.02, 0.02),
    fasciation,
    variegated,
    dwarf,
  };
}

/* ------------------------------------------------------------------ */
/* 骨格生成                                                             */
/* ------------------------------------------------------------------ */

interface SpeciesRule {
  pipeExp: number; // パイプモデルの指数（大きいほど親枝が細くなる）
  maxDepth: number;
  maxBranches: number;
  upTend: number[]; // depth ごとの上向き傾向
  rTip: number;
  taper: number;
  trunkSwell: number;
  minBranchFrac: number; // この割合より下では分岐しない（幹）
  childLen: [number, number];
  floor: number;
}

const RULES: Record<SpeciesId, SpeciesRule> = {
  adenium: {
    pipeExp: 2,
    maxDepth: 3,
    maxBranches: 70,
    upTend: [0.16, 0.13, 0.1, 0.08],
    rTip: 0.027,
    taper: 0.05,
    trunkSwell: 0.5,
    minBranchFrac: 0.25,
    childLen: [0.5, 0.8],
    floor: 0.12,
  },
  decaryia: {
    pipeExp: 2.8,
    maxDepth: 3,
    maxBranches: 140,
    upTend: [0.1, 0.02, 0.015, 0.015, 0.015],
    rTip: 0.0075,
    taper: 0.022,
    trunkSwell: 0.25,
    minBranchFrac: 0.15,
    childLen: [0.6, 0.95],
    floor: 0.1,
  },
};

interface Pending {
  start: V3;
  dir: V3;
  depth: number;
  t: number;
  length: number;
  parent: number;
  parentNode: number;
}

const UP: V3 = [0, 1, 0];

export function generateSkeleton(speciesId: SpeciesId, seed: number, g: Genes): Skeleton {
  const rng = new Rng(seed).fork(2);
  const rule = RULES[speciesId];
  const branches: SkBranch[] = [];
  const events: GrowthEvent[] = [];
  const leanDir: V3 = [Math.cos(g.leanAngle), 0, Math.sin(g.leanAngle)];
  const fanN: V3 = norm([Math.cos(g.leanAngle + 1.3), 0, Math.sin(g.leanAngle + 1.3)]);
  const projectFan = (d: V3, k = 0.85): V3 => (g.fasciation ? norm(sub(d, scale(fanN, dot(d, fanN) * k))) : d);

  /* --- 塊根 --- */
  let caudex: SkCaudex | null = null;
  const isAd = speciesId === 'adenium';
  const cRadius = isAd ? 0.25 * g.caudex * Math.sqrt(g.thickness) : 0.11 * g.caudex * g.thickness;
  const cHeight = isAd ? cRadius * rng.range(0.95, 1.45) * (g.dwarf ? 0.8 : 1) : cRadius * rng.range(1.0, 1.6);
  const lobes = [];
  const nl = rng.int(2, 4);
  for (let i = 0; i < nl; i++) lobes.push({ k: rng.int(2, 6), amp: rng.range(0.02, isAd ? 0.09 : 0.05), phase: rng.range(0, 6.28) });
  caudex = {
    height: cHeight,
    radius: cRadius,
    neck: isAd ? rng.range(0.38, 0.55) * (g.heads > 2 ? 1.25 : 1) : rng.range(0.5, 0.7),
    bulge: isAd ? rng.range(0.05, 0.25) : rng.range(0, 0.15),
    lobes,
    leanX: leanDir[0] * g.lean * cHeight * 0.5,
    leanZ: leanDir[2] * g.lean * cHeight * 0.5,
    wrinkle: rng.range(0.015, 0.045),
  };
  const top: V3 = [caudex.leanX, cHeight * 0.93, caudex.leanZ];

  /* --- 露出根（アデニウム） --- */
  if (isAd) {
    const nr = rng.int(3, 6);
    for (let i = 0; i < nr; i++) {
      const a = (i / nr) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const out: V3 = [Math.cos(a), 0, Math.sin(a)];
      const nodes = [];
      let p: V3 = [out[0] * cRadius * 0.7, cHeight * 0.12, out[2] * cRadius * 0.7];
      let d: V3 = norm([out[0], -0.35, out[2]]);
      const steps = rng.int(3, 5);
      const r0 = cRadius * rng.range(0.16, 0.26);
      for (let k = 0; k <= steps; k++) {
        nodes.push({ p, t: 0.06 + k * 0.035 + i * 0.01, r: r0 * (1 - k / (steps + 1.5)) });
        d = norm(add(d, [rng.gauss() * 0.25, -0.05, rng.gauss() * 0.25]));
        p = add(p, scale(d, cRadius * rng.range(0.22, 0.32)));
        if (p[1] < -0.035) p[1] = -0.035;
      }
      branches.push({ nodes, depth: 0, parent: -1, parentNode: 0, root: true });
    }
  }

  /* --- 幹と枝 --- */
  const queue: Pending[] = [];
  const t0 = isAd ? 0.27 : 0.1;
  const neckR = cRadius * caudex.neck;
  for (let i = 0; i < g.heads; i++) {
    let off: V3 = [0, 0, 0];
    if (g.heads > 1) {
      if (g.fasciation) {
        const f = i / (g.heads - 1) - 0.5;
        const along = norm(cross(fanN, UP));
        off = scale(along, f * neckR * 1.5);
      } else {
        const a = (i / g.heads) * Math.PI * 2 + rng.range(-0.3, 0.3);
        off = [Math.cos(a) * neckR * 0.55, 0, Math.sin(a) * neckR * 0.55];
      }
    }
    const outward = g.heads > 1 ? norm(off) : [0, 0, 0];
    let dir = norm(add(add(UP, scale(outward as V3, 0.38)), scale(leanDir, g.lean * 0.9)));
    dir = norm(add(dir, [rng.gauss() * 0.08, 0, rng.gauss() * 0.08]));
    const lenBase = isAd ? 0.66 : 1.45;
    queue.push({
      start: add(top, add(off, [0, -0.03, 0])),
      dir: projectFan(dir, 0.6),
      depth: 0,
      t: t0 + i * 0.015,
      length: lenBase * g.height * rng.range(0.82, 1.15) * (i === 0 ? 1 : rng.range(0.75, 1)),
      parent: -1,
      parentNode: 0,
    });
  }

  const speed = isAd ? 1.9 : 2.0; // 単位長 / 正規化時間
  // 成長イベントの回数は個体ごとに事前に決める
  let burstLeft = (rng.chance(0.45) ? 1 : 0) + (rng.chance(0.15) ? 1 : 0);
  let turnLeft = (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.12) ? 1 : 0);

  while (queue.length) {
    const pb = queue.shift()!;
    const idx = branches.length;
    const nodes = [{ p: pb.start, t: pb.t, r: 0 }];
    branches.push({ nodes, depth: pb.depth, parent: pb.parent, parentNode: pb.parentNode });
    const n = Math.max(2, Math.round(pb.length / g.internode));
    let mainDir = pb.dir;
    let pos = pb.start;
    let t = pb.t;
    let side = rng.chance(0.5) ? 1 : -1;
    let zigAxis = rotate(perpendicular(mainDir), mainDir, rng.range(0, Math.PI * 2));
    if (g.fasciation) zigAxis = fanN;
    let traveled = 0;
    const up = rule.upTend[pb.depth] ?? 0.03;
    for (let i = 1; i <= n; i++) {
      const c = g.curvature * (pb.depth === 0 ? 0.7 : 1);
      mainDir = norm(add(mainDir, [rng.gauss() * c, up, rng.gauss() * c]));
      mainDir = projectFan(mainDir, 0.5);
      // 成長イベント: 伸長方向の変化
      if (turnLeft > 0 && pb.depth <= 1 && i > 2 && rng.chance(isAd ? 0.06 : 0.02)) {
        turnLeft--;
        mainDir = norm(rotate(mainDir, perpendicular(mainDir), rng.range(0.5, 0.9) * (rng.chance(0.5) ? 1 : -1)));
        if (mainDir[1] < 0.1) mainDir = norm(add(mainDir, [0, 0.4, 0]));
        events.push({ t, label: '伸長方向が変化！' });
      }
      zigAxis = rotate(zigAxis, mainDir, g.twist);
      zigAxis = norm(cross(mainDir, cross(zigAxis, mainDir)));
      const dir = g.zigzag > 0 ? norm(rotate(mainDir, zigAxis, side * g.zigzag)) : mainDir;
      side = -side;
      const step = g.internode * rng.range(0.8, 1.2) * (1 - 0.35 * (i / n)) * (g.dwarf ? 0.8 : 1);
      pos = add(pos, scale(dir, step));
      if (pos[1] < rule.floor) {
        pos[1] = rule.floor;
        mainDir = norm(add(mainDir, [0, 0.5, 0]));
      }
      traveled += step;
      t += step / speed;
      nodes.push({ p: pos, t, r: 0 });

      // 分岐
      const frac = i / n;
      if (pb.depth < rule.maxDepth && i < n - 1 && branches.length + queue.length < rule.maxBranches) {
        if (pb.depth === 0 && frac < rule.minBranchFrac) continue;
        let p = g.branchProb * (0.55 + frac) * (pb.depth === 0 ? 0.9 : 1);
        if (pb.depth >= 2) p *= 0.75;
        let count = rng.chance(p) ? 1 : 0;
        if (count && burstLeft > 0 && pb.depth <= 1 && rng.chance(isAd ? 0.3 : 0.1)) {
          burstLeft--;
          count = rng.int(2, 3);
          events.push({ t, label: '急な分岐！' });
        }
        for (let c2 = 0; c2 < count; c2++) {
          let cd: V3;
          if (g.zigzag > 0) {
            // ジグザグ種: 折れ曲がりの外側へ
            cd = rotate(mainDir, zigAxis, side * g.branchAngle * rng.range(0.85, 1.15));
            if (c2 > 0) cd = rotate(cd, mainDir, rng.range(1.5, 3));
          } else {
            const axis = rotate(perpendicular(mainDir), mainDir, rng.range(0, Math.PI * 2));
            cd = rotate(mainDir, axis, g.branchAngle * rng.range(0.8, 1.2));
          }
          cd = projectFan(norm(cd));
          const remain = pb.length - traveled;
          const cl = Math.max(g.internode * 2.2, remain * rng.range(rule.childLen[0], rule.childLen[1]) + pb.length * 0.12);
          queue.push({
            start: pos,
            dir: cd,
            depth: pb.depth + 1,
            t: t + rng.range(0.01, 0.04),
            length: cl,
            parent: idx,
            parentNode: i,
          });
        }
      }
    }
  }

  /* --- 半径（パイプモデル） --- */
  const childrenAt: Map<number, number[]>[] = branches.map(() => new Map());
  branches.forEach((b, i) => {
    if (b.parent >= 0) {
      const m = childrenAt[b.parent];
      const arr = m.get(b.parentNode) ?? [];
      arr.push(i);
      m.set(b.parentNode, arr);
    }
  });
  const rTip = rule.rTip * g.thickness;
  for (let bi = branches.length - 1; bi >= 0; bi--) {
    const b = branches[bi];
    if (b.root) continue;
    let r = rTip;
    for (let k = b.nodes.length - 1; k >= 0; k--) {
      const e = rule.pipeExp;
      let sum = r ** e;
      const ch = childrenAt[bi].get(k);
      if (ch) for (const c of ch) sum += branches[c].nodes[0].r ** e;
      r = sum ** (1 / e) * (1 + rule.taper);
      b.nodes[k].r = r;
    }
    if (b.depth === 0) {
      const n = b.nodes.length;
      b.nodes.forEach((nd, k) => {
        nd.r *= 1 + rule.trunkSwell * (1 - k / n) ** 2;
      });
    }
  }

  // デカリア: 根元のふくらみを幹の太さに合わせる
  if (!isAd) {
    const trunkR = Math.max(...branches.filter((b) => b.depth === 0 && !b.root).map((b) => b.nodes[0].r));
    caudex.radius = Math.max(caudex.radius, trunkR * 1.3);
    caudex.neck = clamp((trunkR * 1.0) / caudex.radius, 0.45, 0.95);
  }

  /* --- 時間の正規化 --- */
  let maxT = 0;
  for (const b of branches) if (!b.root) for (const nd of b.nodes) maxT = Math.max(maxT, nd.t);
  const tEnd = isAd ? 0.76 : 0.8;
  const remap = (t: number) => t0 + ((t - t0) * (tEnd - t0)) / Math.max(1e-6, maxT - t0);
  for (const b of branches) if (!b.root) for (const nd of b.nodes) nd.t = remap(nd.t);
  for (const e of events) e.t = remap(e.t);

  /* --- 葉・花・トゲ --- */
  const leaves: SkLeaf[] = [];
  const flowers: SkFlower[] = [];
  const spines: SkSpine[] = [];
  const tangent = (b: SkBranch, k: number): V3 => {
    const a = b.nodes[Math.max(0, k - 1)].p;
    const c = b.nodes[Math.min(b.nodes.length - 1, k + 1)].p;
    return norm(sub(c, a));
  };
  let phi = rng.range(0, 6.28);
  const golden = 2.39996;
  branches.forEach((b, bi) => {
    if (b.root) return;
    const n = b.nodes.length;
    if (isAd) {
      // 枝先にロゼット状
      const startK = Math.max(1, n - 3);
      for (let k = startK; k < n; k++) {
        const T = tangent(b, k);
        const per = Math.round((k === n - 1 ? 4 : 2.5) * g.leafDensity + rng.range(-0.5, 0.8));
        for (let j = 0; j < per; j++) {
          phi += golden;
          const p0 = perpendicular(T);
          const out = rotate(p0, T, phi);
          const dir = norm(add(add(scale(T, 0.4 + (k === n - 1 ? 0.35 : 0)), scale(out, 1)), [0, 0.2, 0]));
          const side = norm(cross(dir, out));
          leaves.push({
            b: bi,
            n: k,
            delay: rng.range(0.015, 0.06) + (n - 1 - k) * 0.004,
            t: 0,
            dir,
            side,
            size: 0.15 * g.leafSize * rng.range(0.75, 1.1) * (k === n - 1 ? 0.85 : 1),
            variegated: g.variegated && rng.chance(0.7),
            shed: 2,
          });
        }
      }
      // 花
      if (rng.chance(g.flowerAmount * 0.75)) {
        const nf = rng.int(1, 3);
        const T = tangent(b, n - 1);
        for (let j = 0; j < nf; j++) {
          const dir = norm(add(add(T, [rng.gauss() * 0.5, 0.35, rng.gauss() * 0.5]), scale(perpendicular(T), rng.range(-0.3, 0.3))));
          flowers.push({ b: bi, n: n - 1, t: rng.range(0.82, 0.95), dir, size: rng.range(0.1, 0.135) });
        }
      }
    } else {
      // デカリア: 節ごとに対生の小葉 + トゲ
      for (let k = 1; k < n; k++) {
        if (b.depth === 0 && k / n < 0.25) continue;
        const T = tangent(b, k);
        const bend = sub(b.nodes[k].p, b.nodes[k - 1].p);
        const outside = norm(cross(T, cross(bend, T)));
        const shed = b.depth === 0 ? b.nodes[k].t + 0.25 : b.depth === 1 && k < n * 0.4 ? b.nodes[k].t + 0.4 : 2;
        if (rng.chance(clamp(g.leafDensity * 0.95, 0, 1))) {
          const pair = rng.chance(0.7) ? 2 : 1;
          for (let j = 0; j < pair; j++) {
            const s = j === 0 ? 1 : -1;
            const lat = rotate(outside, T, s * rng.range(0.7, 1.3));
            const dir = norm(add(add(lat, scale(T, 0.35)), [0, 0.35, 0]));
            leaves.push({
              b: bi,
              n: k,
              delay: rng.range(0.01, 0.04),
              t: 0,
              dir,
              side: norm(cross(dir, T)),
              size: 0.036 * g.leafSize * rng.range(0.75, 1.15),
              variegated: g.variegated && rng.chance(0.65),
              shed,
            });
          }
        }
        if (rng.chance(g.spineDensity)) {
          const dir = norm(add(scale(outside, -1), scale(T, -0.2)));
          spines.push({ b: bi, n: k, t: 0, dir, len: rng.range(0.025, 0.045) * g.thickness });
        }
      }
    }
  });
  for (const lf of leaves) lf.t = branches[lf.b].nodes[lf.n].t + lf.delay;
  for (const sp of spines) sp.t = branches[sp.b].nodes[sp.n].t + 0.01;
  // 上限（性能対策）
  if (leaves.length > 2600) leaves.length = 2600;
  if (spines.length > 1400) spines.length = 1400;

  /* --- サイズ --- */
  let height = cHeight;
  let width = cRadius;
  for (const b of branches)
    for (const nd of b.nodes) {
      height = Math.max(height, nd.p[1]);
      width = Math.max(width, Math.hypot(nd.p[0], nd.p[2]));
    }
  height += isAd ? 0.12 : 0.04;
  width += isAd ? 0.12 : 0.04;
  events.sort((a, b) => a.t - b.t);

  return { branches, leaves, flowers, spines, caudex, events, height, width };
}

export function createSpecimen(speciesId: SpeciesId, seed: number): Specimen {
  const genes = makeGenes(speciesId, seed);
  const skeleton = generateSkeleton(speciesId, seed, genes);
  const { traits, rarity, features } = evaluateTraits(speciesId, genes, skeleton);
  return { speciesId, seed, genes, skeleton, traits, rarity, features };
}
