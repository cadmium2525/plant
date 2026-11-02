import type { Genes, Rarity, Skeleton, SpeciesId, Trait } from './types';
import { SPECIES_IDS } from './species';

export const RARITY_INFO: Record<Rarity, { label: string; color: string; stars: number }> = {
  N: { label: 'コモン', color: '#8fa39a', stars: 1 },
  R: { label: 'レア', color: '#5b9bd5', stars: 2 },
  SR: { label: 'スーパーレア', color: '#b57ad8', stars: 3 },
  SSR: { label: '幻の個体', color: '#e3a83b', stars: 4 },
};

/** 種ごとの判定基準 */
const REF: Record<SpeciesId, { caudex: number; tipsHigh: number; tipsLow: number; lanky: number }> = {
  adenium: { caudex: 0.25, tipsHigh: 26, tipsLow: 4, lanky: 1.3 },
  decaryia: { caudex: 0.11, tipsHigh: 110, tipsLow: 18, lanky: 1.45 },
  pachypodium: { caudex: 0.24, tipsHigh: 20, tipsLow: 2, lanky: 99 },
  operculicarya: { caudex: 0.12, tipsHigh: 190, tipsLow: 40, lanky: 1.15 },
  dioscorea: { caudex: 0.36, tipsHigh: 99, tipsLow: 0, lanky: 99 },
  boojum: { caudex: 0.1, tipsHigh: 120, tipsLow: 30, lanky: 99 },
};

/** 種固有の特徴（図鑑の特徴コレクションにも使う） */
const SPECIFIC: Record<SpeciesId, { id: string; label: string }[]> = {
  adenium: [
    { id: 'three', label: '三頭' },
    { id: 'multi', label: '多頭' },
    { id: 'fat', label: 'ぷっくり塊根' },
    { id: 'mega', label: '超肥大塊根' },
    { id: 'white', label: '白花' },
    { id: 'stripe', label: '絞り咲き' },
    { id: 'yellow', label: '黄花' },
  ],
  decaryia: [
    { id: 'multi', label: '株立ち' },
    { id: 'zig', label: '超ジグザグ' },
    { id: 'mega', label: '塊根化' },
  ],
  pachypodium: [
    { id: 'multi', label: '多頭' },
    { id: 'mega', label: '超肥大塊根' },
    { id: 'spiny', label: '剛刺' },
    { id: 'whitefl', label: '白花' },
  ],
  operculicarya: [
    { id: 'multi', label: '株立ち' },
    { id: 'gnarl', label: '超ゴツゴツ' },
    { id: 'mega', label: '塊根化' },
  ],
  dioscorea: [
    { id: 'deep', label: '深い亀甲' },
    { id: 'mega', label: '大玉' },
    { id: 'vines', label: '多つる' },
    { id: 'longvine', label: 'つる長' },
  ],
  boojum: [
    { id: 'fork2', label: '二股' },
    { id: 'fork3', label: '三股' },
    { id: 'arch', label: '弓なり' },
    { id: 'giant', label: '巨大' },
  ],
};

const COMMON = [
  { id: 'std', label: '標準樹形' },
  { id: 'fan', label: '扇状化風' },
  { id: 'vari', label: '斑入り' },
  { id: 'dwarf', label: '矮性' },
  { id: 'twist', label: 'ねじれ' },
  { id: 'lean', label: '懸崖風' },
  { id: 'asym', label: '片流れ' },
  { id: 'dense', label: '枝密' },
  { id: 'drama', label: '劇的成長' },
  { id: 'minimal', label: 'ミニマル' },
  { id: 'lanky', label: 'ひょろ長' },
];

/** 種ごとに出ない共通特徴 */
const EXCLUDE: Partial<Record<SpeciesId, string[]>> = {
  pachypodium: ['twist', 'dense'],
  operculicarya: ['twist', 'asym'],
  dioscorea: ['fan', 'twist', 'lean', 'asym', 'dense', 'minimal', 'lanky'],
  boojum: ['twist', 'asym', 'minimal'],
};

/** 図鑑の「特徴コレクション」用一覧 */
export const TRAIT_CATALOG = Object.fromEntries(
  SPECIES_IDS.map((id) => [id, [COMMON[0], ...SPECIFIC[id], ...COMMON.slice(1).filter((t) => !EXCLUDE[id]?.includes(t.id))]]),
) as Record<SpeciesId, { id: string; label: string }[]>;

/** 生成された形状の特徴から希少度を判定する */
export function evaluateTraits(
  speciesId: SpeciesId,
  g: Genes,
  sk: Skeleton,
): { traits: Trait[]; rarity: Rarity; features: number[] } {
  const traits: Trait[] = [];
  const ex = EXCLUDE[speciesId] ?? [];
  const add = (id: string, label: string, score: number) => {
    if (!ex.includes(id)) traits.push({ id, label, score });
  };
  const ref = REF[speciesId];
  const tips = sk.branches.filter((b) => !b.root).length;
  const c = sk.caudex!;
  const caudexRatio = c.radius / ref.caudex;

  // 重心の偏り（非対称性）
  let cx = 0;
  let cz = 0;
  let cnt = 0;
  for (const b of sk.branches) {
    if (b.root) continue;
    const p = b.nodes[b.nodes.length - 1].p;
    cx += p[0];
    cz += p[2];
    cnt++;
  }
  const asym = cnt ? Math.hypot(cx / cnt, cz / cnt) / Math.max(0.1, sk.width) : 0;

  if (g.fasciation) add('fan', '扇状化風', 4);
  if (g.variegated) add('vari', '斑入り', 3);
  switch (speciesId) {
    case 'adenium':
      if (g.heads >= 4) add('multi', '多頭', 3);
      else if (g.heads === 3) add('three', '三頭', 1);
      if (g.caudex >= 1.45) add('mega', '超肥大塊根', 3);
      else if (caudexRatio >= 1.2) add('fat', 'ぷっくり塊根', 1);
      if (g.flowerHue > 0.1 && g.flowerHue < 0.2) add('yellow', '黄花', 3);
      if (g.flowerPattern === 'stripe') add('stripe', '絞り咲き', 2);
      if (g.flowerSat < 0.1) add('white', '白花', 1);
      break;
    case 'decaryia':
      if (g.heads >= 2) add('multi', '株立ち', 2);
      if (g.zigzag >= 0.92) add('zig', '超ジグザグ', 3);
      if (g.caudex >= 1.3) add('mega', '塊根化', 3);
      break;
    case 'pachypodium':
      if (g.heads >= 5) add('multi', '多頭', 3);
      if (g.caudex >= 1.4) add('mega', '超肥大塊根', 3);
      if (g.caudexSpines >= 1.25) add('spiny', '剛刺', 2);
      if (g.flowerAmount > 0 && g.flowerSat < 0.1) add('whitefl', '白花', 3);
      break;
    case 'operculicarya':
      if (g.heads >= 2) add('multi', '株立ち', 2);
      if (g.knob >= 0.55) add('gnarl', '超ゴツゴツ', 3);
      if (g.caudex >= 1.35) add('mega', '塊根化', 3);
      break;
    case 'dioscorea':
      if (g.crack >= 1.25) add('deep', '深い亀甲', 3);
      if (g.caudex >= 1.35) add('mega', '大玉', 3);
      if (g.heads >= 2) add('vines', '多つる', g.heads >= 3 ? 3 : 2);
      if (g.height >= 1.3) add('longvine', 'つる長', 1);
      break;
    case 'boojum':
      if (g.fork === 2) add('fork2', '二股', 2);
      if (g.fork === 3) add('fork3', '三股', 4);
      if (g.arch) add('arch', '弓なり', 3);
      if (g.height >= 1.28) add('giant', '巨大', 2);
      break;
  }
  if (g.dwarf) add('dwarf', '矮性', 2);
  if (g.twist >= 0.2) add('twist', 'ねじれ', 1);
  if (g.lean >= 0.3) add('lean', '懸崖風', 1);
  if (asym > 0.35) add('asym', '片流れ', 1);
  if (sk.events.length >= 2) add('drama', '劇的成長', 1);

  if (tips >= ref.tipsHigh) add('dense', '枝密', 1);
  // 可愛らしい失敗形（スコア 0 だが記録する）
  if (tips <= ref.tipsLow) add('minimal', 'ミニマル', 0);
  if (sk.height > ref.lanky && caudexRatio < 1) add('lanky', 'ひょろ長', 0);
  if (!traits.length) traits.push({ id: 'std', label: '標準樹形', score: 0 });

  const score = traits.reduce((s, t) => s + t.score, 0);
  const rarity: Rarity = score >= 7 ? 'SSR' : score >= 4 ? 'SR' : score >= 2 ? 'R' : 'N';
  const features = [
    SPECIES_IDS.indexOf(speciesId),
    g.heads / 3,
    caudexRatio,
    sk.height,
    sk.width,
    tips / ref.tipsHigh,
    asym,
    g.zigzag,
    g.fasciation ? 1 : 0,
    g.variegated ? 1 : 0,
  ];
  return { traits, rarity, features };
}

export function featureDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}
