import { createSpecimen } from './plant/generate';
import { featureDistance } from './plant/rarity';
import { SPECIES_IDS } from './plant/species';
import type { Rarity, Specimen } from './plant/types';
import { randomSeed } from './rng';
import { GACHA_COST, Store, uid, type Meta, type SeedItem, type Settings } from './store';

/** アプリ全体の状態 */
export const state = {
  meta: null as unknown as Meta,
  settings: null as unknown as Settings,
};

export async function saveMeta(): Promise<void> {
  try {
    await Store.putMeta(state.meta);
  } catch (e) {
    console.error(e);
    alert('データの保存に失敗しました。ストレージの空き容量やプライベートモードを確認してください。');
  }
}

/** 抽選: 候補を複数作り、直近の個体と似ていないものを優先する */
export function drawSeed(): { item: SeedItem; specimen: Specimen } {
  const recent = state.meta.recentFeatures;
  let best: Specimen | null = null;
  let bestScore = -1;
  for (let i = 0; i < 3; i++) {
    const sp = SPECIES_IDS[Math.floor(Math.random() * SPECIES_IDS.length)];
    const cand = createSpecimen(sp, randomSeed());
    const d = recent.length ? Math.min(...recent.map((f) => featureDistance(f, cand.features))) : 1;
    // 最初の候補を基本としつつ、似すぎていたら差し替え
    const score = i === 0 ? d + 0.25 : d;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  const specimen = best!;
  state.meta.recentFeatures = [specimen.features, ...recent].slice(0, 5);
  const item: SeedItem = {
    id: uid(),
    speciesId: specimen.speciesId,
    seed: specimen.seed,
    rarity: specimen.rarity,
    drawnAt: Date.now(),
  };
  return { item, specimen };
}

export function canDraw(): boolean {
  return state.meta.points >= GACHA_COST;
}

/** ポイント不足かつ種もない時の救済 */
export function needsRescue(): boolean {
  return state.meta.points < GACHA_COST && state.meta.inventory.length === 0;
}

export const REWARD: Record<Rarity, number> = { N: 35, R: 45, SR: 60, SSR: 90 };
export const DISCOVERY_BONUS = 15;

/** 図鑑登録時の報酬計算（新発見の特徴も記録） */
export function grantReward(sp: Specimen): { total: number; newTraits: string[] } {
  const newTraits: string[] = [];
  for (const t of sp.traits) {
    const key = `${sp.speciesId}:${t.id}`;
    if (!state.meta.discoveredTraits.includes(key)) {
      state.meta.discoveredTraits.push(key);
      newTraits.push(t.label);
    }
  }
  const total = REWARD[sp.rarity] + newTraits.length * DISCOVERY_BONUS;
  state.meta.points += total;
  state.meta.stats.grown++;
  return { total, newTraits };
}
