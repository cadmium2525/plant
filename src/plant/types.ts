export type V3 = [number, number, number];

export type SpeciesId = 'adenium' | 'decaryia';

/** 個体の遺伝パラメータ（seed から決定的に導出） */
export interface Genes {
  heads: number; // 主幹（頭）の数
  height: number; // 全体の高さ係数
  thickness: number; // 幹の太さ係数
  caudex: number; // 塊根の肥大係数
  curvature: number; // 曲がりやすさ
  lean: number; // 傾き量
  leanAngle: number; // 傾きの向き
  branchProb: number; // 分岐確率
  branchAngle: number; // 分岐角（rad）
  internode: number; // 節間長
  zigzag: number; // ジグザグ角（rad）
  twist: number; // ねじれ
  leafDensity: number;
  leafSize: number;
  flowerAmount: number;
  flowerHue: number; // 0..1
  flowerSat: number;
  flowerLight: number;
  flowerPattern: 'plain' | 'edge' | 'stripe';
  spineDensity: number;
  barkHue: number;
  // 希少変異
  fasciation: boolean; // 扇状化風
  variegated: boolean; // 斑入り
  dwarf: boolean; // 矮性
}

export interface SkNode {
  p: V3;
  t: number; // 出現時刻（0..1 正規化成長時間）
  r: number; // 最終半径
}

export interface SkBranch {
  nodes: SkNode[];
  depth: number;
  parent: number; // 親ブランチ index（-1: 根元）
  parentNode: number;
  root?: boolean; // 露出根
}

export interface SkLeaf {
  b: number; // 付着ブランチ
  n: number; // 付着ノード
  delay: number;
  t: number; // 出現時刻（後で計算）
  dir: V3;
  side: V3; // 葉の幅方向のヒント
  size: number;
  variegated: boolean;
  shed: number; // 落葉時刻（>1 なら落ちない）
}

export interface SkFlower {
  b: number;
  n: number;
  t: number;
  dir: V3;
  size: number;
}

export interface SkSpine {
  b: number;
  n: number;
  t: number;
  dir: V3;
  len: number;
}

export interface SkCaudex {
  height: number;
  radius: number;
  neck: number; // 首の半径比
  bulge: number;
  lobes: { k: number; amp: number; phase: number }[];
  leanX: number;
  leanZ: number;
  wrinkle: number;
}

export interface GrowthEvent {
  t: number;
  label: string;
}

export interface Skeleton {
  branches: SkBranch[];
  leaves: SkLeaf[];
  flowers: SkFlower[];
  spines: SkSpine[];
  caudex: SkCaudex | null;
  events: GrowthEvent[];
  height: number; // 最終高さ
  width: number; // 最終の最大水平半径
}

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export interface Trait {
  id: string;
  label: string;
  score: number;
}

export interface Specimen {
  speciesId: SpeciesId;
  seed: number;
  genes: Genes;
  skeleton: Skeleton;
  traits: Trait[];
  rarity: Rarity;
  features: number[]; // 類似判定用の特徴ベクトル
}
