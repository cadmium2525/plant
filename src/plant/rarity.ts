import type { Genes, Rarity, Skeleton, SpeciesId, Trait } from './types';

export const RARITY_INFO: Record<Rarity, { label: string; color: string; stars: number }> = {
  N: { label: 'コモン', color: '#8fa39a', stars: 1 },
  R: { label: 'レア', color: '#5b9bd5', stars: 2 },
  SR: { label: 'スーパーレア', color: '#b57ad8', stars: 3 },
  SSR: { label: '幻の個体', color: '#e3a83b', stars: 4 },
};

/** 生成された形状の特徴から希少度を判定する */
export function evaluateTraits(
  speciesId: SpeciesId,
  g: Genes,
  sk: Skeleton,
): { traits: Trait[]; rarity: Rarity; features: number[] } {
  const traits: Trait[] = [];
  const add = (id: string, label: string, score: number) => traits.push({ id, label, score });
  const isAd = speciesId === 'adenium';
  const tips = sk.branches.filter((b) => !b.root).length;
  const c = sk.caudex!;
  const caudexRatio = c.radius / (isAd ? 0.25 : 0.11);

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
  if (isAd) {
    if (g.heads >= 4) add('multi', '多頭', 3);
    else if (g.heads === 3) add('three', '三頭', 1);
    if (g.caudex >= 1.45) add('mega', '超肥大塊根', 3);
    else if (caudexRatio >= 1.2) add('fat', 'ぷっくり塊根', 1);
    if (g.flowerHue > 0.1 && g.flowerHue < 0.2) add('yellow', '黄花', 3);
    if (g.flowerPattern === 'stripe') add('stripe', '絞り咲き', 2);
    if (g.flowerSat < 0.1) add('white', '白花', 1);
  } else {
    if (g.heads >= 2) add('multi', '株立ち', 2);
    if (g.zigzag >= 0.7) add('zig', '超ジグザグ', 3);
    if (g.caudex >= 1.3) add('mega', '塊根化', 3);
  }
  if (g.dwarf) add('dwarf', '矮性', 2);
  if (g.twist >= 0.2) add('twist', 'ねじれ', 1);
  if (g.lean >= 0.3) add('lean', '懸崖風', 1);
  if (asym > 0.35) add('asym', '片流れ', 1);
  if (sk.events.length >= 2) add('drama', '劇的成長', 1);

  const tipsHigh = isAd ? 26 : 200;
  const tipsLow = isAd ? 4 : 40;
  if (tips >= tipsHigh) add('dense', '枝密', 1);
  // 可愛らしい失敗形（スコア 0 だが記録する）
  if (tips <= tipsLow) add('minimal', 'ミニマル', 0);
  if (sk.height > (isAd ? 1.3 : 1.45) && caudexRatio < 1) add('lanky', 'ひょろ長', 0);
  if (!traits.length) add('std', '標準樹形', 0);

  const score = traits.reduce((s, t) => s + t.score, 0);
  const rarity: Rarity = score >= 7 ? 'SSR' : score >= 4 ? 'SR' : score >= 2 ? 'R' : 'N';
  const features = [
    isAd ? 0 : 1,
    g.heads / 3,
    caudexRatio,
    sk.height,
    sk.width,
    tips / tipsHigh,
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

/** 図鑑の「特徴コレクション」用一覧 */
export const TRAIT_CATALOG: Record<SpeciesId, { id: string; label: string }[]> = {
  adenium: [
    { id: 'std', label: '標準樹形' },
    { id: 'three', label: '三頭' },
    { id: 'multi', label: '多頭' },
    { id: 'fat', label: 'ぷっくり塊根' },
    { id: 'mega', label: '超肥大塊根' },
    { id: 'white', label: '白花' },
    { id: 'stripe', label: '絞り咲き' },
    { id: 'yellow', label: '黄花' },
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
  ],
  decaryia: [
    { id: 'std', label: '標準樹形' },
    { id: 'multi', label: '株立ち' },
    { id: 'zig', label: '超ジグザグ' },
    { id: 'mega', label: '塊根化' },
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
  ],
};
