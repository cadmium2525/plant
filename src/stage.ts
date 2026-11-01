import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PlantModel } from './plant/mesh';
import { Pot, type PotDeco } from './pot';
import type { Specimen } from './plant/types';

export type LightPreset = 'day' | 'warm' | 'night' | 'studio';
export type Quality = 'low' | 'mid' | 'high';

export const LIGHT_PRESETS: { id: LightPreset; label: string }[] = [
  { id: 'day', label: '昼光' },
  { id: 'warm', label: '夕方' },
  { id: 'night', label: '夜' },
  { id: 'studio', label: 'スタジオ' },
];

function shadowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** 1つの WebGL キャンバスを画面間で使い回す 3D ステージ */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  readonly controls: OrbitControls;
  readonly root = new THREE.Group();
  plant: PlantModel | null = null;
  pot: Pot | null = null;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private shadow: THREE.Mesh;
  private dirty = true;
  private host: HTMLElement | null = null;
  private ro: ResizeObserver;
  private last = performance.now();
  onFrame: ((dt: number) => void) | null = null;
  quality: Quality = 'mid';

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.9);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(2, 4, 3);
    this.rim = new THREE.DirectionalLight(0xbfd8ff, 0.9);
    this.rim.position.set(-3, 2, -2.5);
    this.scene.add(this.hemi, this.key, this.rim, this.root);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    const el = this.renderer.domElement;
    el.className = 'stage-canvas';
    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.addEventListener('change', () => (this.dirty = true));

    this.ro = new ResizeObserver(() => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      this.tick();
    };
    requestAnimationFrame(loop);
    this.setLight('day');
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const cap = q === 'high' ? 2 : q === 'mid' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.resize();
  }

  /** 指定要素にキャンバスを差し込む */
  attach(host: HTMLElement): void {
    if (this.host) this.ro.unobserve(this.host);
    this.host = host;
    host.appendChild(this.renderer.domElement);
    this.ro.observe(host);
    this.resize();
  }

  detach(): void {
    if (this.host) this.ro.unobserve(this.host);
    this.host = null;
    this.renderer.domElement.remove();
    this.onFrame = null;
    this.controls.autoRotate = false;
  }

  resize(): void {
    if (!this.host) return;
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.host) return;
    if (this.onFrame) {
      this.onFrame(dt);
      this.dirty = true;
    }
    const moved = this.controls.update(dt);
    if (moved || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** 植物と鉢を差し替える */
  show(specimen: Specimen, deco: PotDeco, t = 1): void {
    this.clear();
    const plant = new PlantModel(specimen, this.quality);
    plant.update(t);
    const caudexR = specimen.skeleton.caudex?.radius ?? 0.1;
    const pot = new Pot(deco, caudexR);
    pot.onChange = () => this.invalidate();
    this.plant = plant;
    this.pot = pot;
    this.root.add(pot, plant);
    // 鉢の拡大に合わせて植物も配置
    this.layout();
    this.frame();
  }

  /** 鉢形状が変わった時など、位置合わせをやり直す */
  layout(): void {
    if (!this.plant || !this.pot) return;
    this.plant.position.y = -0.035 * this.pot.scaleFactor;
    const potH = this.pot.potHeight;
    this.root.position.y = 0;
    this.shadow.position.y = -potH - 0.002;
    const s = this.pot.innerR * 3.2;
    this.shadow.scale.set(s, s, 1);
    this.invalidate();
  }

  /** 植物全体が収まるようにカメラを置く */
  frame(): void {
    if (!this.plant || !this.pot) return;
    const sk = this.plant.specimen.skeleton;
    const top = sk.height;
    const bottom = -this.pot.potHeight;
    const midY = (top + bottom) / 2;
    const half = Math.max((top - bottom) / 2, Math.max(sk.width, this.pot.innerR) * 0.95);
    const fov = (this.camera.fov * Math.PI) / 180;
    const aspect = Math.max(0.5, this.camera.aspect);
    const dist = (half / Math.tan(fov / 2)) * 1.4 * Math.max(1, 0.75 / aspect);
    this.controls.target.set(0, midY, 0);
    const dir = new THREE.Vector3(0.0, 0.32, 1).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.controls.minDistance = dist * 0.35;
    this.controls.maxDistance = dist * 2.2;
    this.controls.update();
    this.invalidate();
  }

  clear(): void {
    if (this.plant) {
      this.root.remove(this.plant);
      this.plant.dispose();
      this.plant = null;
    }
    if (this.pot) {
      this.root.remove(this.pot);
      this.pot.dispose();
      this.pot = null;
    }
    this.invalidate();
  }

  setLight(p: LightPreset): void {
    const set = (h: number, g: number, hi: number, k: number, ki: number, r: number, ri: number, exp: number) => {
      this.hemi.color.set(h);
      this.hemi.groundColor.set(g);
      this.hemi.intensity = hi;
      this.key.color.set(k);
      this.key.intensity = ki;
      this.rim.color.set(r);
      this.rim.intensity = ri;
      this.renderer.toneMappingExposure = exp;
    };
    if (p === 'day') set(0xffffff, 0x8a7a66, 0.8, 0xfff8ee, 1.9, 0xcfe0ff, 0.9, 1.0);
    if (p === 'warm') set(0xffe2c0, 0x6a5040, 0.7, 0xffb070, 2.6, 0x8fb0ff, 0.7, 1.0);
    if (p === 'night') set(0x7088c0, 0x202030, 0.45, 0xa8c0ff, 1.2, 0xff9ad0, 1.6, 1.0);
    if (p === 'studio') set(0xffffff, 0x444444, 0.4, 0xffffff, 3.2, 0xffffff, 2.2, 1.0);
    this.key.position.set(p === 'warm' ? 3.5 : 2, p === 'warm' ? 2 : 4, 3);
    this.invalidate();
  }

  /**
   * 現在のカメラで指定サイズの画像を描画して返す（透明背景）。
   * 同期的に描いてすぐ読み出すので preserveDrawingBuffer は不要。
   */
  snapshot(w: number, h: number): HTMLCanvasElement {
    const r = this.renderer;
    const prevRatio = r.getPixelRatio();
    const prevSize = r.getSize(new THREE.Vector2());
    const prevAspect = this.camera.aspect;
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(r.domElement, 0, 0, w, h);
    r.setPixelRatio(prevRatio);
    r.setSize(prevSize.x, prevSize.y, false);
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    return out;
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
