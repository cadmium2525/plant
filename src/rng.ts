// シード付き疑似乱数（mulberry32）。同じシードから必ず同じ列を返す。
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** おおよそ正規分布（中心 0, 幅 ±1 程度） */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 0.75;
  }
  /** 派生シード: 部位ごとに独立した乱数列を得る */
  fork(salt: number): Rng {
    return new Rng(hash2(this.s, salt));
  }
}

export function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

/** 個体ID表示用: シードを短い英数字に */
export function seedCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase().padStart(7, '0');
}
