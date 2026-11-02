import type { SpeciesId } from './types';
import type { PotShape } from '../pot';

export type BarkKind = 'smooth' | 'rough' | 'tortoise';
export type LeafKind = 'obovate' | 'round' | 'lance' | 'heart';
export type SeedKind = 'tuft2' | 'tuft1' | 'drupe' | 'wing' | 'fig';

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  latin: string;
  family: string;
  desc: string;
  duration: number; // 成長演出の秒数
  barkOld: [number, number, number]; // HSL
  barkYoung: [number, number, number];
  caudexColor: [number, number, number];
  leafColor: [number, number, number];
  packet: string; // 種袋の色
  pot: PotShape; // 植え付け時の初期鉢
  look: {
    bark: BarkKind;
    caudexTex: BarkKind;
    leaf: LeafKind;
    sides: number; // 枝の断面の分割数
    tipR: number; // 成長点の太さ
    smooth: [number, number]; // 太い幹の平滑化 [しきい値, 強さ]
    uvScale: number;
    barkRough: number;
    leafRough: number;
  };
  /** 育成画面の段階表示 */
  phase: { t0: number; base: string; last: string };
  seed: { kind: SeedKind; color: string; size: number };
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  adenium: {
    id: 'adenium',
    name: 'アデニウム',
    latin: 'Adenium obesum',
    family: 'キョウチクトウ科',
    desc: 'ぷっくり膨らむ塊根と、枝先に咲く鮮やかな花。「砂漠のバラ」とも呼ばれる。',
    duration: 55,
    barkOld: [0.08, 0.15, 0.4],
    barkYoung: [0.22, 0.25, 0.5],
    caudexColor: [0.075, 0.2, 0.36],
    leafColor: [0.29, 0.55, 0.3],
    packet: '#d9776f',
    pot: 'bowl',
    look: { bark: 'smooth', caudexTex: 'smooth', leaf: 'obovate', sides: 10, tipR: 0.016, smooth: [0, 0.7], uvScale: 1.5, barkRough: 0.62, leafRough: 0.38 },
    phase: { t0: 0.27, base: '根元がふくらむ', last: '開花' },
    seed: { kind: 'tuft2', color: '#9a7b55', size: 1 },
  },
  decaryia: {
    id: 'decaryia',
    name: 'デカリア',
    latin: 'Decarya madagascariensis',
    family: 'ディディエレア科',
    desc: 'ジグザグに折れ曲がる枝と、節ごとの小さな丸葉とトゲ。マダガスカル原産。',
    duration: 45,
    barkOld: [0.07, 0.07, 0.4],
    barkYoung: [0.2, 0.18, 0.42],
    caudexColor: [0.07, 0.08, 0.38],
    leafColor: [0.27, 0.5, 0.36],
    packet: '#6f9a7d',
    pot: 'round',
    look: { bark: 'rough', caudexTex: 'rough', leaf: 'round', sides: 8, tipR: 0.006, smooth: [0.35, 0.5], uvScale: 3, barkRough: 0.85, leafRough: 0.6 },
    phase: { t0: 0.1, base: '根を張る', last: '樹形が締まる' },
    seed: { kind: 'drupe', color: '#7a6a4f', size: 0.7 },
  },
  pachypodium: {
    id: 'pachypodium',
    name: 'パキポディウム・グラキリス',
    latin: 'Pachypodium rosulatum var. gracilius',
    family: 'キョウチクトウ科',
    desc: '銀色に光るまんまるの塊根に細かなトゲ。短い枝が二股に分かれ、黄色い花を咲かせる。',
    duration: 55,
    barkOld: [0.1, 0.06, 0.52],
    barkYoung: [0.2, 0.18, 0.48],
    caudexColor: [0.1, 0.07, 0.53],
    leafColor: [0.3, 0.5, 0.3],
    packet: '#c9a227',
    pot: 'bowl',
    look: { bark: 'smooth', caudexTex: 'smooth', leaf: 'lance', sides: 10, tipR: 0.018, smooth: [0, 0.7], uvScale: 1.5, barkRough: 0.45, leafRough: 0.35 },
    phase: { t0: 0.3, base: '塊根がまるくなる', last: '開花' },
    seed: { kind: 'tuft1', color: '#8a6b45', size: 0.9 },
  },
  operculicarya: {
    id: 'operculicarya',
    name: 'オペルクリカリア・パキプス',
    latin: 'Operculicarya pachypus',
    family: 'ウルシ科',
    desc: 'ゴツゴツとねじれる太い幹と、細かく茂る小枝。小さな盆栽のような風格。',
    duration: 50,
    barkOld: [0.06, 0.12, 0.3],
    barkYoung: [0.08, 0.2, 0.36],
    caudexColor: [0.06, 0.12, 0.28],
    leafColor: [0.3, 0.55, 0.26],
    packet: '#8c5a3c',
    pot: 'bowl',
    look: { bark: 'rough', caudexTex: 'rough', leaf: 'round', sides: 8, tipR: 0.005, smooth: [0.3, 0.55], uvScale: 2.5, barkRough: 0.9, leafRough: 0.55 },
    phase: { t0: 0.12, base: '根元が締まる', last: '小枝が茂る' },
    seed: { kind: 'drupe', color: '#6b3b2a', size: 0.6 },
  },
  dioscorea: {
    id: 'dioscorea',
    name: '亀甲竜',
    latin: 'Dioscorea elephantipes',
    family: 'ヤマノイモ科',
    desc: '亀の甲羅のようにひび割れた半球状の塊根から、ハート形の葉をつけたつるが伸びる。',
    duration: 50,
    barkOld: [0.2, 0.3, 0.32],
    barkYoung: [0.25, 0.45, 0.42],
    caudexColor: [0.07, 0.3, 0.3],
    leafColor: [0.28, 0.55, 0.32],
    packet: '#7b6a9e',
    pot: 'bowl',
    look: { bark: 'smooth', caudexTex: 'tortoise', leaf: 'heart', sides: 6, tipR: 0.004, smooth: [0, 0.5], uvScale: 3, barkRough: 0.6, leafRough: 0.45 },
    phase: { t0: 0.32, base: '亀甲が育つ', last: 'つるが巻く' },
    seed: { kind: 'wing', color: '#b59a6a', size: 0.9 },
  },
  gajumaru: {
    id: 'gajumaru',
    name: 'ガジュマル',
    latin: 'Ficus microcarpa',
    family: 'クワ科',
    desc: 'タコ足のようにうねって地表を這う太い根と、人参形にふくらむ根元。枝から気根を垂らす「多幸の木」。',
    duration: 50,
    barkOld: [0.07, 0.12, 0.36],
    barkYoung: [0.14, 0.2, 0.42],
    caudexColor: [0.07, 0.14, 0.37],
    leafColor: [0.32, 0.6, 0.24],
    packet: '#4f8a5b',
    pot: 'bowl',
    look: { bark: 'smooth', caudexTex: 'smooth', leaf: 'obovate', sides: 10, tipR: 0.01, smooth: [0, 0.7], uvScale: 1.5, barkRough: 0.55, leafRough: 0.22 },
    phase: { t0: 0.22, base: '根が張り出す', last: '葉が茂る' },
    seed: { kind: 'fig', color: '#7c5a8c', size: 0.8 },
  },
  boojum: {
    id: 'boojum',
    name: 'ブージャム',
    latin: 'Fouquieria columnaris',
    family: 'フーキエリア科',
    desc: '逆さにしたニンジンのような一本幹に、短いトゲの小枝が全身から突き出す不思議な樹形。',
    duration: 50,
    barkOld: [0.14, 0.28, 0.5],
    barkYoung: [0.2, 0.32, 0.46],
    caudexColor: [0.13, 0.26, 0.46],
    leafColor: [0.26, 0.6, 0.38],
    packet: '#5f8fa8',
    pot: 'tall',
    look: { bark: 'smooth', caudexTex: 'smooth', leaf: 'round', sides: 10, tipR: 0.012, smooth: [0, 0.6], uvScale: 1.2, barkRough: 0.6, leafRough: 0.5 },
    phase: { t0: 0.08, base: '芽が伸びる', last: '小枝が出そろう' },
    seed: { kind: 'wing', color: '#cbb894', size: 0.7 },
  },
};

export const SPECIES_IDS: SpeciesId[] = ['adenium', 'decaryia', 'pachypodium', 'operculicarya', 'dioscorea', 'boojum', 'gajumaru'];

export function isSpeciesId(s: string): s is SpeciesId {
  return (SPECIES_IDS as string[]).includes(s);
}
