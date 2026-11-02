export type V3 = [number, number, number];

export type SpeciesId = 'adenium' | 'decaryia' | 'pachypodium' | 'operculicarya' | 'dioscorea' | 'boojum' | 'gajumaru';

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
  // 追加種用（既存種では 0 / false）
  knob: number; // 幹のゴツゴツ（オペルクリカリア）
  helix: number; // つるの巻き（亀甲竜）
  crack: number; // 亀甲の割れの深さ（亀甲竜）
  caudexSpines: number; // 塊根のトゲ量（パキポディウム）
  fork: number; // 先端の分かれ数（ブージャム: 0 なら一本）
  arch: boolean; // 先端が弓なりに垂れる（ブージャム）
  rootLegs: number; // 地表を這う太い根の本数（ガジュマル）
  aerial: number; // 枝から垂れる気根の本数（ガジュマル）
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
  off?: number; // 花茎の長さ（先端からの距離）
}

export interface SkSpine {
  b: number; // -1 のときは塊根の表面（p を使う）
  n: number;
  t: number;
  dir: V3;
  len: number;
  p?: V3; // 塊根トゲの位置（塊根の最終形での座標）
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
  shape?: 'bottle' | 'ball' | 'dome'; // 省略時は bottle
  tortoise?: number; // 亀甲模様の深さ（0: なし）
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
