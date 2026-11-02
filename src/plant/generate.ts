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
import { caudexPoint } from './caudex';

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

/** 既存2種では使わない遺伝子（乱数を消費しないよう固定値） */
const EXTRA_OFF = { knob: 0, helix: 0, crack: 0, caudexSpines: 0, fork: 0, arch: false, rootLegs: 0, aerial: 0 };

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
      ...EXTRA_OFF,
      fasciation,
      variegated,
      dwarf,
    };
  }
  if (speciesId !== 'decaryia') return makeNewGenes(speciesId, rng, { dwarf, fasciation, variegated });
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
    ...EXTRA_OFF,
    fasciation,
    variegated,
    dwarf,
  };
}


/** 追加種の遺伝パラメータ */
function makeNewGenes(
  speciesId: SpeciesId,
  rng: Rng,
  rare: { dwarf: boolean; fasciation: boolean; variegated: boolean },
): Genes {
  const { dwarf, variegated } = rare;
  const base = {
    leanAngle: rng.range(0, Math.PI * 2),
    barkHue: rng.range(-0.015, 0.015),
    leafSize: rng.range(0.85, 1.2),
    flowerHue: 0,
    flowerSat: 0,
    flowerLight: 0,
    flowerPattern: 'plain' as const,
    flowerAmount: 0,
    zigzag: 0,
    twist: 0,
    knob: 0,
    helix: 0,
    crack: 0,
    caudexSpines: 0,
    fork: 0,
    arch: false,
    rootLegs: 0,
    aerial: 0,
    variegated,
    dwarf,
  };
  switch (speciesId) {
    case 'pachypodium': {
      const fasciation = rare.fasciation;
      const hr = rng.next();
      return {
        ...base,
        heads: fasciation ? rng.int(4, 6) : hr < 0.35 ? 1 : hr < 0.7 ? 2 : hr < 0.9 ? 3 : rng.int(5, 7),
        height: rng.range(0.8, 1.2) * (dwarf ? 0.6 : 1),
        thickness: rng.range(0.85, 1.25),
        caudex: rng.chance(0.08) ? rng.range(1.45, 1.7) : rng.range(0.85, 1.2),
        curvature: rng.range(0.05, 0.2),
        lean: rng.chance(0.08) ? rng.range(0.3, 0.45) : rng.range(0, 0.12),
        branchProb: 0,
        branchAngle: rng.range(0.4, 0.7),
        internode: 0.065,
        leafDensity: rng.range(0.8, 1.2),
        flowerAmount: rng.range(0.5, 1),
        flowerHue: rng.chance(0.06) ? 0.0 : 0.14,
        flowerSat: rng.chance(0.06) ? 0.05 : 0.9,
        flowerLight: 0.6,
        spineDensity: rng.range(0.3, 0.6),
        caudexSpines: rng.chance(0.1) ? rng.range(1.3, 1.6) : rng.range(0.5, 1),
        fasciation,
      };
    }
    case 'gajumaru': {
      const octopus = rng.chance(0.1);
      const forest = rng.chance(0.08);
      return {
        ...base,
        heads: rng.chance(0.15) ? rng.int(2, 3) : 1,
        height: rng.range(0.85, 1.15) * (dwarf ? 0.65 : 1),
        thickness: rng.range(0.85, 1.2),
        caudex: rng.chance(0.08) ? rng.range(1.4, 1.65) : rng.range(0.8, 1.15),
        curvature: rng.range(0.2, 0.4),
        lean: rng.chance(0.12) ? rng.range(0.3, 0.5) : rng.range(0, 0.18),
        branchProb: rng.range(0.6, 0.8),
        branchAngle: rng.range(0.7, 1.0),
        internode: 0.06,
        twist: rng.range(0.05, 0.15),
        leafDensity: rng.range(0.75, 1.1),
        spineDensity: 0,
        rootLegs: octopus ? rng.int(9, 12) : rng.int(4, 7),
        aerial: forest ? rng.int(10, 16) : rng.int(0, 4),
        fasciation: rare.fasciation,
      };
    }
    case 'operculicarya': {
      const gnarly = rng.chance(0.09);
      return {
        ...base,
        heads: rng.chance(0.12) ? 2 : 1,
        height: rng.range(0.85, 1.15) * (dwarf ? 0.65 : 1),
        thickness: rng.range(0.85, 1.2),
        caudex: rng.chance(0.08) ? rng.range(1.4, 1.6) : rng.range(0.8, 1.1),
        curvature: rng.range(0.32, 0.55),
        lean: rng.chance(0.12) ? rng.range(0.3, 0.5) : rng.range(0, 0.18),
        branchProb: rng.range(0.55, 0.78),
        branchAngle: rng.range(0.8, 1.1),
        internode: 0.055,
        zigzag: rng.range(0.18, 0.32),
        twist: rng.range(0.05, 0.15),
        leafDensity: rng.range(0.6, 0.9),
        spineDensity: 0,
        knob: gnarly ? rng.range(0.6, 0.8) : rng.range(0.2, 0.42),
        fasciation: rare.fasciation,
      };
    }
    case 'dioscorea': {
      const deep = rng.chance(0.1);
      const hr = rng.next();
      return {
        ...base,
        heads: hr < 0.82 ? 1 : hr < 0.96 ? 2 : 3,
        height: rng.chance(0.08) ? rng.range(1.35, 1.5) : rng.range(0.85, 1.15) * (dwarf ? 0.6 : 1),
        thickness: rng.range(0.85, 1.2),
        caudex: rng.chance(0.08) ? rng.range(1.4, 1.6) : rng.range(0.8, 1.15) * (dwarf ? 0.8 : 1),
        curvature: rng.range(0.05, 0.12),
        lean: 0,
        branchProb: rng.range(0.18, 0.3),
        branchAngle: rng.range(0.6, 0.9),
        internode: 0.06,
        leafDensity: rng.range(0.7, 1),
        spineDensity: 0,
        helix: rng.range(0.45, 0.65) * (rng.chance(0.5) ? 1 : -1),
        crack: deep ? rng.range(1.3, 1.6) : rng.range(0.6, 1.05),
        fasciation: false,
      };
    }
    default: {
      // boojum
      const fr = rng.next();
      return {
        ...base,
        heads: 1,
        height: rng.chance(0.08) ? rng.range(1.3, 1.45) : rng.range(0.85, 1.15) * (dwarf ? 0.6 : 1),
        thickness: rng.range(0.85, 1.2),
        caudex: rng.range(0.8, 1.1),
        curvature: rng.range(0.02, 0.07),
        lean: rng.chance(0.1) ? rng.range(0.25, 0.4) : rng.range(0, 0.1),
        branchProb: rng.range(0.75, 0.95),
        branchAngle: rng.range(1.2, 1.45),
        internode: 0.045,
        leafDensity: rng.range(0.7, 1.1),
        spineDensity: rng.range(0.6, 1),
        fork: fr < 0.8 ? 0 : fr < 0.95 ? 2 : 3,
        arch: rng.chance(0.09),
        fasciation: rare.fasciation,
      };
    }
  }
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
  t0: number; // 幹が伸び始める時刻（それまでは塊根が育つ）
  tEnd: number; // 枝の伸長が終わる時刻
  lenBase: number; // 幹の長さ
  speed: number; // 単位長 / 正規化時間
  turnProb: number; // 「伸長方向が変化」イベントの確率
  burstProb: number; // 「急な分岐」イベントの確率
  margin: number; // 葉・花の分の余白
  fitCaudex: boolean; // 根元のふくらみを幹の太さに合わせる
  leafMode: 'rosette' | 'pairs' | 'alternate' | 'clusters' | 'crown';
  tipSplit?: number[]; // depth ごとの先端二股分岐の確率
  twigLen?: [number, number]; // 幹から出る小枝の長さ（固定）
  carrot?: number; // 逆ニンジン形の幹の根元半径
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
    t0: 0.27,
    tEnd: 0.76,
    lenBase: 0.66,
    speed: 1.9,
    turnProb: 0.06,
    burstProb: 0.3,
    margin: 0.12,
    fitCaudex: false,
    leafMode: 'rosette',
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
    t0: 0.1,
    tEnd: 0.8,
    lenBase: 1.45,
    speed: 2.0,
    turnProb: 0.02,
    burstProb: 0.1,
    margin: 0.04,
    fitCaudex: true,
    leafMode: 'pairs',
  },
  pachypodium: {
    pipeExp: 2,
    maxDepth: 2,
    maxBranches: 40,
    upTend: [0.14, 0.1, 0.08],
    rTip: 0.03,
    taper: 0.06,
    trunkSwell: 0.25,
    minBranchFrac: 1,
    childLen: [0.5, 0.8],
    floor: 0.2,
    t0: 0.3,
    tEnd: 0.72,
    lenBase: 0.22,
    speed: 1.0,
    turnProb: 0.03,
    burstProb: 0,
    margin: 0.2,
    fitCaudex: false,
    leafMode: 'rosette',
    tipSplit: [0.9, 0.6],
  },
  operculicarya: {
    pipeExp: 2.25,
    maxDepth: 4,
    maxBranches: 200,
    upTend: [0.07, 0.04, 0.03, 0.02, 0.02],
    rTip: 0.0055,
    taper: 0.035,
    trunkSwell: 0.9,
    minBranchFrac: 0.2,
    childLen: [0.65, 0.95],
    floor: 0.08,
    t0: 0.12,
    tEnd: 0.8,
    lenBase: 0.95,
    speed: 1.6,
    turnProb: 0.12,
    burstProb: 0.15,
    margin: 0.04,
    fitCaudex: true,
    leafMode: 'pairs',
  },
  dioscorea: {
    pipeExp: 2,
    maxDepth: 2,
    maxBranches: 14,
    upTend: [0.025, 0.02, 0.02],
    rTip: 0.006,
    taper: 0.008,
    trunkSwell: 0,
    minBranchFrac: 0.3,
    childLen: [0.35, 0.6],
    floor: 0.05,
    t0: 0.32,
    tEnd: 0.82,
    lenBase: 1.25,
    speed: 2.4,
    turnProb: 0,
    burstProb: 0,
    margin: 0.1,
    fitCaudex: false,
    leafMode: 'alternate',
  },
  gajumaru: {
    pipeExp: 2.3,
    maxDepth: 3,
    maxBranches: 90,
    upTend: [0.1, 0.05, 0.03, 0.02],
    rTip: 0.009,
    taper: 0.04,
    trunkSwell: 0.4,
    minBranchFrac: 0.3,
    childLen: [0.55, 0.85],
    floor: 0.15,
    t0: 0.22,
    tEnd: 0.76,
    lenBase: 0.62,
    speed: 1.7,
    turnProb: 0.06,
    burstProb: 0.2,
    margin: 0.1,
    fitCaudex: false,
    leafMode: 'crown',
  },
  boojum: {
    pipeExp: 2,
    maxDepth: 1,
    maxBranches: 170,
    upTend: [0.2, -0.03],
    rTip: 0.011,
    taper: 0.01,
    trunkSwell: 0,
    minBranchFrac: 0.06,
    childLen: [0.5, 0.8],
    floor: 0.1,
    t0: 0.08,
    tEnd: 0.8,
    lenBase: 1.75,
    speed: 2.6,
    turnProb: 0.01,
    burstProb: 0,
    margin: 0.06,
    fitCaudex: true,
    leafMode: 'clusters',
    twigLen: [0.14, 0.26],
    carrot: 0.13,
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

/** 塊根の初期形状（既存2種は従来どおりの乱数順） */
function makeCaudex(speciesId: SpeciesId, g: Genes, rng: Rng, leanDir: V3): SkCaudex {
  if (speciesId === 'adenium' || speciesId === 'decaryia') {
    const isAd = speciesId === 'adenium';
    const cRadius = isAd ? 0.25 * g.caudex * Math.sqrt(g.thickness) : 0.11 * g.caudex * g.thickness;
    const cHeight = isAd ? cRadius * rng.range(0.95, 1.45) * (g.dwarf ? 0.8 : 1) : cRadius * rng.range(1.0, 1.6);
    const lobes = [];
    const nl = rng.int(2, 4);
    for (let i = 0; i < nl; i++) lobes.push({ k: rng.int(2, 6), amp: rng.range(0.02, isAd ? 0.09 : 0.05), phase: rng.range(0, 6.28) });
    return {
      height: cHeight,
      radius: cRadius,
      neck: isAd ? rng.range(0.38, 0.55) * (g.heads > 2 ? 1.25 : 1) : rng.range(0.5, 0.7),
      bulge: isAd ? rng.range(0.05, 0.25) : rng.range(0, 0.15),
      lobes,
      leanX: leanDir[0] * g.lean * cHeight * 0.5,
      leanZ: leanDir[2] * g.lean * cHeight * 0.5,
      wrinkle: rng.range(0.015, 0.045),
    };
  }
  const lobes = [];
  const nl = rng.int(2, 3);
  for (let i = 0; i < nl; i++) lobes.push({ k: rng.int(2, 5), amp: rng.range(0.015, 0.05), phase: rng.range(0, 6.28) });
  if (speciesId === 'pachypodium') {
    const radius = 0.24 * g.caudex * Math.sqrt(g.thickness);
    const height = radius * rng.range(1.45, 1.9) * (g.dwarf ? 0.8 : 1);
    return {
      shape: 'ball',
      height,
      radius,
      neck: rng.range(0.28, 0.4) * (g.heads > 3 ? 1.3 : 1),
      bulge: 0,
      lobes,
      leanX: leanDir[0] * g.lean * height * 0.5,
      leanZ: leanDir[2] * g.lean * height * 0.5,
      wrinkle: rng.range(0.005, 0.015),
    };
  }
  if (speciesId === 'dioscorea') {
    const radius = 0.36 * g.caudex;
    return {
      shape: 'dome',
      tortoise: g.crack,
      height: radius * rng.range(0.55, 0.8),
      radius,
      neck: 0.12,
      bulge: 0,
      lobes,
      leanX: 0,
      leanZ: 0,
      wrinkle: 0.01,
    };
  }
  if (speciesId === 'gajumaru') {
    // 人参形にふくらんだ根元（ゴツゴツしたこぶが多い）
    const radius = 0.17 * g.caudex * Math.sqrt(g.thickness);
    const height = radius * rng.range(1.1, 1.6) * (g.dwarf ? 0.8 : 1);
    for (const lb of lobes) lb.amp *= 2.2;
    return {
      height,
      radius,
      neck: rng.range(0.5, 0.65) * (g.heads > 1 ? 1.2 : 1),
      bulge: rng.range(0.1, 0.3),
      lobes,
      leanX: leanDir[0] * g.lean * height * 0.5,
      leanZ: leanDir[2] * g.lean * height * 0.5,
      wrinkle: rng.range(0.04, 0.07),
    };
  }
  // operculicarya / boojum: 幹の根元のふくらみ（あとで幹に合わせる）
  const radius = (speciesId === 'boojum' ? 0.1 : 0.12) * g.caudex * g.thickness;
  return {
    height: radius * rng.range(0.8, 1.2),
    radius,
    neck: 0.6,
    bulge: rng.range(0.05, 0.2),
    lobes,
    leanX: 0,
    leanZ: 0,
    wrinkle: rng.range(0.02, 0.05),
  };
}

export function generateSkeleton(speciesId: SpeciesId, seed: number, g: Genes): Skeleton {
  const rng = new Rng(seed).fork(2);
  const rule = RULES[speciesId];
  const isAd = speciesId === 'adenium';
  const branches: SkBranch[] = [];
  const events: GrowthEvent[] = [];
  const leanDir: V3 = [Math.cos(g.leanAngle), 0, Math.sin(g.leanAngle)];
  const fanN: V3 = norm([Math.cos(g.leanAngle + 1.3), 0, Math.sin(g.leanAngle + 1.3)]);
  const projectFan = (d: V3, k = 0.85): V3 => (g.fasciation ? norm(sub(d, scale(fanN, dot(d, fanN) * k))) : d);

  /* --- 塊根 --- */
  const caudex = makeCaudex(speciesId, g, rng, leanDir);
  const cRadius = caudex.radius;
  const cHeight = caudex.height;
  const topY = caudex.shape === 'dome' ? cHeight * 1.0 : caudex.shape === 'ball' ? cHeight * 0.97 : cHeight * 0.93;
  const top: V3 = [caudex.leanX, topY, caudex.leanZ];

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
        // 鉢の内径（塊根の1.3倍以上）からはみ出さないように
        const hr = Math.hypot(p[0], p[2]);
        if (hr > cRadius * 1.15) p = [(p[0] * cRadius * 1.15) / hr, p[1], (p[2] * cRadius * 1.15) / hr];
      }
      branches.push({ nodes, depth: 0, parent: -1, parentNode: 0, root: true });
    }
  }
  /* --- タコ足の根（ガジュマル）: 根元から四方へうねりながら地表を這う --- */
  if (g.rootLegs > 0) {
    const nr = g.rootLegs;
    const a0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < nr; i++) {
      const a = a0 + (i / nr) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const out: V3 = [Math.cos(a), 0, Math.sin(a)];
      const nodes = [];
      const h0 = cHeight * rng.range(0.25, 0.6);
      let p: V3 = [caudex.leanX * 0.3 + out[0] * cRadius * 0.55, h0, caudex.leanZ * 0.3 + out[2] * cRadius * 0.55];
      let d: V3 = norm([out[0], -0.25, out[2]]);
      const steps = rng.int(5, 8);
      const r0 = cRadius * rng.range(0.2, 0.32);
      const reach = cRadius * rng.range(1.5, 1.9);
      for (let k = 0; k <= steps; k++) {
        nodes.push({ p, t: 0.05 + k * 0.03 + i * 0.006, r: r0 * (1 - k / (steps + 2)) });
        // 地表に沿ってうねる
        d = norm(add(d, [rng.gauss() * 0.35, -0.12, rng.gauss() * 0.35]));
        p = add(p, scale(d, cRadius * rng.range(0.25, 0.35)));
        if (p[1] < 0.0) {
          p[1] = rng.range(-0.02, 0.01);
          d = norm([d[0], 0.15, d[2]]);
        }
        const hr = Math.hypot(p[0], p[2]);
        if (hr > reach) p = [(p[0] * reach) / hr, p[1] - 0.03, (p[2] * reach) / hr];
      }
      branches.push({ nodes, depth: 0, parent: -1, parentNode: 0, root: true });
    }
  }

  /* --- 幹と枝 --- */
  const queue: Pending[] = [];
  const t0 = rule.t0;
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
    if (g.helix) {
      // つる: 横向き成分を持たせて螺旋に
      const a = rng.range(0, Math.PI * 2) + i * 2.1;
      dir = norm([Math.cos(a), 1.1, Math.sin(a)]);
    }
    queue.push({
      start: add(top, add(off, [0, -0.03, 0])),
      dir: projectFan(dir, 0.6),
      depth: 0,
      t: t0 + i * 0.015,
      length: rule.lenBase * g.height * rng.range(0.82, 1.15) * (i === 0 ? 1 : rng.range(0.75, 1)) * (g.fork ? 0.72 : 1),
      parent: -1,
      parentNode: 0,
    });
  }

  const speed = rule.speed;
  // 成長イベントの回数は個体ごとに事前に決める
  let burstLeft = (rng.chance(0.45) ? 1 : 0) + (rng.chance(0.15) ? 1 : 0);
  let turnLeft = (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.12) ? 1 : 0);
  let forkLeft = g.fork;

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
    const up0 = rule.upTend[pb.depth] ?? 0.03;
    for (let i = 1; i <= n; i++) {
      const c = g.curvature * (pb.depth === 0 ? 0.7 : 1);
      // ブージャムの弓なり: 先端側で下向きに垂れる
      const up = g.arch && pb.depth === 0 && i / n > 0.55 ? -0.12 : up0;
      if (g.helix) mainDir = rotate(mainDir, UP, g.helix);
      mainDir = norm(add(mainDir, [rng.gauss() * c, up, rng.gauss() * c]));
      mainDir = projectFan(mainDir, 0.5);
      // 成長イベント: 伸長方向の変化
      if (turnLeft > 0 && pb.depth <= 1 && i > 2 && rng.chance(rule.turnProb)) {
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
        // 小枝が全身から出る種は1節に2本出ることもある
        if (count && rule.twigLen && rng.chance(0.6)) count = 2;
        if (count && burstLeft > 0 && pb.depth <= 1 && rng.chance(rule.burstProb)) {
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
          // 小枝は幹の中心から出るので、太い幹（逆ニンジン形）の分だけ長くして表面から突き出させる
          const trunkR = rule.carrot && pb.depth === 0 ? rule.carrot * g.thickness * Math.pow(1 - 0.88 * frac, 1.5) + 0.01 : 0;
          const cl = rule.twigLen
            ? rng.range(rule.twigLen[0], rule.twigLen[1]) * (1 - frac * 0.45) * (g.dwarf ? 0.8 : 1) + trunkR
            : Math.max(g.internode * 2.2, remain * rng.range(rule.childLen[0], rule.childLen[1]) + pb.length * 0.12);
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

    // 先端での二股分岐（パキポディウム）
    if (rule.tipSplit && pb.depth < rule.maxDepth && rng.chance(rule.tipSplit[pb.depth] ?? 0)) {
      const k = rng.chance(0.2) ? 3 : 2;
      const axis0 = rotate(perpendicular(mainDir), mainDir, rng.range(0, Math.PI * 2));
      for (let c2 = 0; c2 < k; c2++) {
        const axis = rotate(axis0, mainDir, (c2 / k) * Math.PI * 2);
        const cd = projectFan(norm(rotate(mainDir, axis, g.branchAngle * rng.range(0.8, 1.2))));
        queue.push({
          start: pos,
          dir: cd,
          depth: pb.depth + 1,
          t: t + rng.range(0.01, 0.03),
          length: pb.length * rng.range(rule.childLen[0], rule.childLen[1]),
          parent: idx,
          parentNode: nodes.length - 1,
        });
      }
    }
    // 先端が二股・三股に分かれる幹（ブージャム）
    if (forkLeft > 0 && pb.depth === 0 && pb.parent < 0) {
      const k = forkLeft;
      forkLeft = 0;
      const axis0 = rotate(perpendicular(mainDir), mainDir, rng.range(0, Math.PI * 2));
      for (let c2 = 0; c2 < k; c2++) {
        const axis = rotate(axis0, mainDir, (c2 / k) * Math.PI * 2);
        queue.push({
          start: pos,
          dir: norm(rotate(mainDir, axis, rng.range(0.3, 0.5))),
          depth: 0,
          t: t + 0.01,
          length: pb.length * rng.range(0.35, 0.5),
          parent: idx,
          parentNode: nodes.length - 1,
        });
      }
      events.push({ t, label: '幹が分かれた！' });
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
    // 逆ニンジン形の幹（ブージャム）
    if (rule.carrot && b.depth === 0) {
      const n = b.nodes.length;
      const base = b.parent < 0 ? rule.carrot * g.thickness : branches[b.parent].nodes[b.parentNode].r * 0.75;
      b.nodes.forEach((nd, k) => {
        nd.r = Math.max(nd.r, base * Math.pow(1 - (0.88 * k) / n, 1.5) + 0.01);
      });
    }
  }
  // ゴツゴツした幹（オペルクリカリア）: 節ごとに太さをばらつかせる
  if (g.knob > 0) {
    for (const b of branches) {
      if (b.root || b.depth > 1) continue;
      let prev = 1;
      b.nodes.forEach((nd) => {
        const f = 1 + g.knob * (rng.next() * 1.1 - 0.35) * (b.depth === 0 ? 1 : 0.5);
        const sm = (prev + f) / 2;
        prev = f;
        nd.r *= sm;
      });
    }
  }

  // 塊根の上から出る幹は、塊根の首より太くしない（太すぎると曲がり目で筒が潰れて板状に見える）
  if (!rule.fitCaudex && caudex.shape !== 'dome') {
    const cap = Math.max(cRadius * caudex.neck * 1.1, rule.rTip * 2.2);
    for (const b of branches) if (!b.root) for (const nd of b.nodes) nd.r = Math.min(nd.r, cap);
  }

  // 根元のふくらみを幹の太さに合わせる
  if (rule.fitCaudex) {
    const trunkR = Math.max(...branches.filter((b) => b.depth === 0 && !b.root).map((b) => b.nodes[0].r));
    caudex.radius = Math.max(caudex.radius, trunkR * 1.3);
    caudex.neck = clamp((trunkR * 1.0) / caudex.radius, 0.45, 0.95);
  }

  /* --- 時間の正規化 --- */
  let maxT = 0;
  for (const b of branches) if (!b.root) for (const nd of b.nodes) maxT = Math.max(maxT, nd.t);
  const tEnd = rule.tEnd;
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
  const hasChildAtTip = (bi: number) => (childrenAt[bi].get(branches[bi].nodes.length - 1)?.length ?? 0) > 0;
  branches.forEach((b, bi) => {
    if (b.root) return;
    const n = b.nodes.length;
    if (rule.leafMode === 'rosette') {
      // 枝先にロゼット状（パキポディウムは二股の手前の枝には付けない）
      if (!isAd && hasChildAtTip(bi)) return;
      const startK = Math.max(1, n - 3);
      const narrow = !isAd;
      for (let k = startK; k < n; k++) {
        const T = tangent(b, k);
        const per = Math.round((k === n - 1 ? 4 : 2.5) * g.leafDensity + rng.range(-0.5, 0.8)) + (narrow ? 1 : 0);
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
            size: (narrow ? 0.12 : 0.15) * g.leafSize * rng.range(0.75, 1.1) * (k === n - 1 ? 0.85 : 1),
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
          if (isAd) flowers.push({ b: bi, n: n - 1, t: rng.range(0.82, 0.95), dir, size: rng.range(0.1, 0.135) });
          else flowers.push({ b: bi, n: n - 1, t: rng.range(0.84, 0.96), dir: norm(add(dir, [0, 0.6, 0])), size: rng.range(0.075, 0.095), off: rng.range(0.1, 0.18) });
        }
      }
      // 枝のトゲ（パキポディウム）
      if (!isAd)
        for (let k = 1; k < n; k++) {
          if (!rng.chance(g.spineDensity)) continue;
          const T = tangent(b, k);
          const dir = norm(add(rotate(perpendicular(T), T, rng.range(0, 6.28)), scale(T, 0.3)));
          spines.push({ b: bi, n: k, t: 0, dir, len: rng.range(0.02, 0.035) });
        }
    } else if (rule.leafMode === 'pairs') {
      // デカリア・オペルクリカリア: 節ごとに対生の小葉
      const small = speciesId === 'operculicarya';
      for (let k = 1; k < n; k++) {
        if (b.depth === 0 && k / n < 0.25) continue;
        if (small && b.depth < 2) continue;
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
              size: (small ? 0.028 : 0.036) * g.leafSize * rng.range(0.75, 1.15),
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
    } else if (rule.leafMode === 'crown') {
      // ガジュマル: 枝の外側半分に、つやのある楕円の葉がらせん状に茂る
      if (b.depth === 0 && n > 3) return;
      for (let k = Math.max(1, Math.floor(n * 0.35)); k < n; k++) {
        const T = tangent(b, k);
        const per = Math.round((k === n - 1 ? 3 : 1.6) * g.leafDensity + rng.range(-0.4, 0.6));
        for (let j = 0; j < per; j++) {
          phi += golden;
          const out = rotate(perpendicular(T), T, phi);
          const dir = norm(add(add(scale(out, 1), scale(T, 0.45)), [0, 0.25, 0]));
          leaves.push({
            b: bi,
            n: k,
            delay: rng.range(0.015, 0.05),
            t: 0,
            dir,
            side: norm(cross(dir, out)),
            size: 0.085 * g.leafSize * rng.range(0.8, 1.15),
            variegated: g.variegated && rng.chance(0.7),
            shed: 2,
          });
        }
      }
    } else if (rule.leafMode === 'alternate') {
      // 亀甲竜: つるにハート形の葉が互生
      for (let k = 2; k < n; k++) {
        if (!rng.chance(g.leafDensity)) continue;
        const T = tangent(b, k);
        phi += 2.8;
        const out = rotate(perpendicular(T), T, phi);
        // 葉身が外を向いて垂れ下がるように
        const dir = norm(add(add(scale(out, 0.55), scale(T, 0.1)), [0, -0.75, 0]));
        leaves.push({
          b: bi,
          n: k,
          delay: rng.range(0.01, 0.04),
          t: 0,
          dir,
          side: norm(cross(out, [0, 1, 0])),
          size: 0.13 * g.leafSize * rng.range(0.75, 1.15) * (k > n - 3 ? 0.6 : 1),
          variegated: g.variegated && rng.chance(0.7),
          shed: 2,
        });
      }
    } else {
      // ブージャム: 小枝に小さな葉が束生、トゲが1本
      if (b.depth === 0) return;
      for (let k = 1; k < n; k++) {
        const T = tangent(b, k);
        const cnt = Math.round(rng.range(1, 3.2) * g.leafDensity);
        for (let j = 0; j < cnt; j++) {
          const out = rotate(perpendicular(T), T, rng.range(0, 6.28));
          const dir = norm(add(add(out, scale(T, 0.6)), [0, 0.4, 0]));
          leaves.push({
            b: bi,
            n: k,
            delay: rng.range(0.01, 0.05),
            t: 0,
            dir,
            side: norm(cross(dir, T)),
            size: 0.045 * g.leafSize * rng.range(0.75, 1.2),
            variegated: g.variegated && rng.chance(0.6),
            shed: 2,
          });
        }
        if (rng.chance(g.spineDensity * 0.7)) {
          const dir = norm(add(scale(T, 0.5), [rng.gauss() * 0.3, -0.3, rng.gauss() * 0.3]));
          spines.push({ b: bi, n: k, t: 0, dir, len: rng.range(0.025, 0.04) });
        }
      }
    }
  });
  for (const lf of leaves) lf.t = branches[lf.b].nodes[lf.n].t + lf.delay;
  for (const sp of spines) sp.t = branches[sp.b].nodes[sp.n].t + 0.01;

  /* --- 気根（ガジュマル）: 枝から細い根が垂れ下がり、長いものは土に届く --- */
  if (g.aerial > 0) {
    const cands = branches
      .map((b, bi) => ({ b, bi }))
      .filter(({ b }) => !b.root && b.depth >= 1 && b.depth <= 2 && b.nodes.length > 2);
    for (let i = 0; i < g.aerial && cands.length; i++) {
      const { b } = cands[rng.int(0, cands.length - 1)];
      const k = rng.int(1, Math.max(1, Math.floor(b.nodes.length * 0.6)));
      const start = b.nodes[k].p;
      if (start[1] < 0.25) continue;
      const reachSoil = g.aerial >= 10 || rng.chance(0.35);
      const len = reachSoil ? start[1] + 0.02 : start[1] * rng.range(0.25, 0.6);
      const steps = Math.max(3, Math.round(len / 0.07));
      const nodes = [];
      let p: V3 = start;
      const r0 = reachSoil ? rng.range(0.008, 0.016) : rng.range(0.004, 0.007);
      for (let s2 = 0; s2 <= steps; s2++) {
        nodes.push({ p, t: Math.min(0.96, b.nodes[k].t + 0.12 + s2 * 0.018), r: r0 * (1 - (s2 / steps) * 0.4) });
        p = add(p, [rng.gauss() * 0.008, -len / steps, rng.gauss() * 0.008]);
      }
      branches.push({ nodes, depth: 1, parent: -1, parentNode: 0, root: true });
    }
  }

  // 塊根のトゲ（パキポディウム）: 塊根と一緒に育つ
  if (g.caudexSpines > 0) {
    const sites = Math.round(110 * g.caudexSpines);
    for (let i = 0; i < sites; i++) {
      const h = rng.range(0.1, 0.93);
      const th = rng.range(0, Math.PI * 2);
      const cl = rng.int(1, 3);
      for (let j = 0; j < cl; j++) {
        const th2 = th + rng.range(-0.06, 0.06);
        const p = caudexPoint(caudex, h, th2);
        const dir = norm([Math.cos(th2) + rng.gauss() * 0.3, 0.2 + (h - 0.5) * 0.9 + rng.gauss() * 0.2, Math.sin(th2) + rng.gauss() * 0.3]);
        spines.push({ b: -1, n: 0, t: 0.04 + h * 0.22 + rng.range(0, 0.04), dir, len: rng.range(0.025, 0.045) * (g.caudexSpines > 1.2 ? 1.3 : 1), p });
      }
    }
  }

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
  height += rule.margin;
  width += rule.margin;
  events.sort((a, b) => a.t - b.t);

  return { branches, leaves, flowers, spines, caudex, events, height, width };
}

export function createSpecimen(speciesId: SpeciesId, seed: number): Specimen {
  const genes = makeGenes(speciesId, seed);
  const skeleton = generateSkeleton(speciesId, seed, genes);
  const { traits, rarity, features } = evaluateTraits(speciesId, genes, skeleton);
  return { speciesId, seed, genes, skeleton, traits, rarity, features };
}
