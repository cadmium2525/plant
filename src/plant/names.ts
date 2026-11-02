import { Rng } from '../rng';
import type { SpeciesId, Specimen } from './types';

const PRE: Record<SpeciesId, string[]> = {
  adenium: ['ぷく', 'ころ', 'もち', 'ぽて', 'まる', 'ふく', 'だる', 'むち'],
  decaryia: ['ジグ', 'くね', 'カク', 'ザグ', 'ぎざ', 'えだ', 'トゲ', 'ちょこ'],
  pachypodium: ['ぎん', 'たま', 'まり', 'とげ', 'まん', 'ころ', 'ぼん', 'きら'],
  operculicarya: ['ごつ', 'じい', 'ねじ', 'こぶ', 'もさ', 'しぶ', 'げん', 'わび'],
  dioscorea: ['かめ', 'こう', 'ひび', 'まき', 'つる', 'どん', 'ぼこ', 'がめ'],
  gajumaru: ['ガジュ', 'キジ', 'タコ', 'ねっこ', 'もり', 'うね', 'しま', 'ふく'],
  boojum: ['にん', 'のっぽ', 'ぼう', 'すっ', 'ひょろ', 'つん', 'のび', 'もじゃ'],
};
const SUF = ['丸', '太郎', 'すけ', '姫', '坊', '吉', 'べえ', 'ちゃん', 'ノ森', '左衛門'];

/** 個体の特徴から仮の名前を付ける */
export function defaultName(sp: Specimen): string {
  const rng = new Rng(sp.seed).fork(99);
  const ids = new Set(sp.traits.map((t) => t.id));
  let pre = rng.pick(PRE[sp.speciesId]);
  if (ids.has('legs')) pre = 'すらり';
  else if (ids.has('mega')) pre = 'でぶ';
  else if (ids.has('multi')) pre = sp.speciesId === 'adenium' || sp.speciesId === 'pachypodium' ? 'やまた' : 'なかよし';
  else if (ids.has('fan')) pre = 'おうぎ';
  else if (ids.has('vari')) pre = 'ゆき';
  else if (ids.has('dwarf')) pre = 'ちび';
  else if (ids.has('twist')) pre = 'ねじ';
  else if (ids.has('lanky')) pre = 'のっぽ';
  else if (ids.has('arch')) pre = 'おじぎ';
  else if (ids.has('gnarl')) pre = 'ごつごつ';
  else if (ids.has('deep')) pre = 'げんぶ';
  else if (ids.has('octopus')) pre = 'タコ';
  else if (ids.has('forest')) pre = 'もりもり';
  return pre + rng.pick(SUF);
}
