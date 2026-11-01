import type { Rarity, SpeciesId } from './plant/types';
import type { PotDeco } from './pot';
import type { LightPreset, Quality } from './stage';

/* ------------------------------------------------------------------ */
/* データ型                                                             */
/* ------------------------------------------------------------------ */

export interface StudioSettings {
  bg: string; // プリセット ID or 'custom' or 'image'
  bgColor: string;
  bgImage: string | null; // dataURL
  light: LightPreset;
  frame: 'specimen' | 'minimal' | 'dark';
  aspect: '4:5' | '9:16';
  caption: string;
  showInfo: boolean;
  cam: [number, number, number] | null; // カメラ位置（ターゲットからの相対）
}

export const DEFAULT_STUDIO: StudioSettings = {
  bg: 'paper',
  bgColor: '#e9efe6',
  bgImage: null,
  light: 'day',
  frame: 'specimen',
  aspect: '4:5',
  caption: '',
  showInfo: true,
  cam: null,
};

/** 図鑑に保存された個体（seed から形状を再生成するので軽量） */
export interface SavedPlant {
  id: string;
  speciesId: SpeciesId;
  seed: number;
  name: string;
  createdAt: number;
  rarity: Rarity;
  tags: string[];
  deco: PotDeco;
  studio: StudioSettings;
  thumb: string; // dataURL
  card?: string; // 最後に書き出したカードのサムネイル
}

export interface SeedItem {
  id: string;
  speciesId: SpeciesId;
  seed: number;
  rarity: Rarity;
  drawnAt: number;
}

export interface Meta {
  points: number;
  inventory: SeedItem[];
  discoveredTraits: string[]; // speciesId:traitId
  recentFeatures: number[][];
  stats: { draws: number; grown: number; exports: number; skips: number };
  latestCard: string | null;
}

export interface Settings {
  quality: Quality;
  reduceMotion: boolean;
  defaultSpeed: number;
}

export const GACHA_COST = 40;

const DEFAULT_META: Meta = {
  points: 120,
  inventory: [],
  discoveredTraits: [],
  recentFeatures: [],
  stats: { draws: 0, grown: 0, exports: 0, skips: 0 },
  latestCard: null,
};

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */

const DB_NAME = 'botanical-oddities';
const DB_VER = 1;
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('plants')) d.createObjectStore('plants', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((res, rej) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => res(r.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      }),
  );
}

export const Store = {
  async allPlants(): Promise<SavedPlant[]> {
    const list = await tx<SavedPlant[]>('plants', 'readonly', (s) => s.getAll() as IDBRequest<SavedPlant[]>);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },
  getPlant(id: string): Promise<SavedPlant | undefined> {
    return tx<SavedPlant | undefined>('plants', 'readonly', (s) => s.get(id) as IDBRequest<SavedPlant | undefined>);
  },
  async putPlant(p: SavedPlant): Promise<void> {
    await tx('plants', 'readwrite', (s) => s.put(p));
  },
  async deletePlant(id: string): Promise<void> {
    await tx('plants', 'readwrite', (s) => s.delete(id));
  },
  async getMeta(): Promise<Meta> {
    const m = await tx<Meta | undefined>('meta', 'readonly', (s) => s.get('meta') as IDBRequest<Meta | undefined>);
    return { ...structuredClone(DEFAULT_META), ...(m ?? {}) };
  },
  async putMeta(m: Meta): Promise<void> {
    await tx('meta', 'readwrite', (s) => s.put(m, 'meta'));
  },
  async clearAll(): Promise<void> {
    await tx('plants', 'readwrite', (s) => s.clear());
    await tx('meta', 'readwrite', (s) => s.clear());
  },
};

/* ------------------------------------------------------------------ */
/* 設定（localStorage）                                                 */
/* ------------------------------------------------------------------ */

const SETTINGS_KEY = 'bo-settings';

export function loadSettings(): Settings {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const def: Settings = { quality: 'mid', reduceMotion: reduce, defaultSpeed: 1 };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return def;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 保存できない環境では無視 */
  }
}

/* ------------------------------------------------------------------ */
/* JSON バックアップ                                                    */
/* ------------------------------------------------------------------ */

export async function exportJSON(): Promise<string> {
  const plants = await Store.allPlants();
  const meta = await Store.getMeta();
  return JSON.stringify({ app: 'botanical-oddities', version: 1, exportedAt: Date.now(), meta, plants });
}

export async function importJSON(text: string): Promise<number> {
  const data = JSON.parse(text);
  if (data?.app !== 'botanical-oddities' || !Array.isArray(data.plants)) throw new Error('形式が違います');
  for (const p of data.plants as SavedPlant[]) {
    if (typeof p.id !== 'string' || typeof p.seed !== 'number') continue;
    await Store.putPlant(p);
  }
  if (data.meta) {
    const cur = await Store.getMeta();
    const m = data.meta as Meta;
    cur.points = Math.max(cur.points, m.points ?? 0);
    const have = new Set(cur.inventory.map((i) => i.id));
    for (const it of m.inventory ?? []) if (!have.has(it.id)) cur.inventory.push(it);
    cur.discoveredTraits = [...new Set([...cur.discoveredTraits, ...(m.discoveredTraits ?? [])])];
    await Store.putMeta(cur);
  }
  return data.plants.length;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
