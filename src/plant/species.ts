import type { SpeciesId } from './types';

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
  },
};

export const SPECIES_IDS: SpeciesId[] = ['adenium', 'decaryia'];
