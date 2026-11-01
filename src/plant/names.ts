import { Rng } from '../rng';
import type { Specimen } from './types';

const PRE_AD = ['ぷく', 'ころ', 'もち', 'ぽて', 'まる', 'ふく', 'だる', 'むち'];
const PRE_DE = ['ジグ', 'くね', 'カク', 'ザグ', 'ぎざ', 'えだ', 'トゲ', 'ちょこ'];
const SUF = ['丸', '太郎', 'すけ', '姫', '坊', '吉', 'べえ', 'ちゃん', 'ノ森', '左衛門'];

/** 個体の特徴から仮の名前を付ける */
export function defaultName(sp: Specimen): string {
  const rng = new Rng(sp.seed).fork(99);
  const ids = new Set(sp.traits.map((t) => t.id));
  let pre = rng.pick(sp.speciesId === 'adenium' ? PRE_AD : PRE_DE);
  if (ids.has('mega')) pre = 'でぶ';
  else if (ids.has('multi')) pre = sp.speciesId === 'adenium' ? 'やまた' : 'なかよし';
  else if (ids.has('fan')) pre = 'おうぎ';
  else if (ids.has('vari')) pre = 'ゆき';
  else if (ids.has('dwarf')) pre = 'ちび';
  else if (ids.has('twist')) pre = 'ねじ';
  else if (ids.has('lanky')) pre = 'のっぽ';
  return pre + rng.pick(SUF);
}
