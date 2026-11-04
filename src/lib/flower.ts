import { Color, Group, Object3D, type Mesh, type MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Plant } from './plant';
import { assetUrl } from './assets';
import { hash, smooth, TAU } from './math';

export type FlowerPreset = 'daisy' | 'tulip' | 'lavender';
export interface FlowerConfig {
  preset?: FlowerPreset;
  count?: number;
  size?: number;
  area?: [number, number];
  seed?: number;
  color?: string;
}

const loader = new GLTFLoader();
const modelPaths: Record<FlowerPreset, string> = {
  daisy: '/models/flower_white.glb',
  tulip: '/models/flower_yellow.glb',
  lavender: '/models/flower_blue.glb',
};
const models = new Map<string, Promise<Object3D>>();

function loadModel(preset: FlowerPreset): Promise<Object3D> {
  const path = assetUrl(modelPaths[preset]);
  let model = models.get(path);
  if (!model) {
    model = loader.loadAsync(path).then((gltf) => gltf.scene.children[0]);
    models.set(path, model);
  }
  return model;
}

export class Flower extends Plant {
  private readonly count: number;
  private readonly size: number;
  private readonly area: [number, number];
  private readonly seed: number;
  private readonly preset: FlowerPreset;
  private readonly color?: string;
  private readonly instances = new Group();
  private readonly phases: number[] = [];
  private readonly scales: number[] = [];
  private disposed = false;

  constructor(config: FlowerConfig = {}) {
    super();
    this.name = 'VerdantFlowers';
    this.count = Math.max(0, Math.floor(config.count ?? 50));
    this.size = Math.max(0.05, config.size ?? 1);
    this.area = config.area ?? [1000, 1000];
    this.seed = config.seed ?? 44;
    this.preset = config.preset ?? 'daisy';
    this.color = config.color;
    this.add(this.instances);
    loadModel(this.preset)
      .then((model) => this.initialize(model))
      .catch((error) => {
        console.error('[Verdant Motion] Failed to load EZ-Tree flower model.', error);
      });
  }

  private initialize(model: Object3D): void {
    if (this.disposed) return;
    const radius = Math.max(2, Math.min(this.area[0], this.area[1]) * 0.5);
    for (let i = 0; i < this.count; i++) {
      const angle = hash(this.seed * 13 + i * 31) * TAU;
      const inner = Math.min(10, radius * 0.1);
      const distance = Math.sqrt(
        inner * inner + hash(this.seed * 19 + i * 47) * (radius * radius - inner * inner),
      );
      const flower = model.clone(true);
      flower.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      flower.rotation.y = hash(this.seed * 23 + i * 59) * TAU;
      this.scales.push((0.02 + hash(this.seed * 29 + i * 67) * 0.03) * this.size);
      flower.traverse((object) => {
        if ((object as { isMesh?: boolean }).isMesh) {
          const mesh = object as Mesh;
          mesh.geometry = mesh.geometry.clone();
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => m.clone())
            : mesh.material.clone();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            const standard = material as MeshStandardMaterial;
            if (standard.color) {
              if (this.color) standard.color.set(this.color);
              standard.userData.baseColor = standard.color.clone();
            }
          }
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      this.phases.push(hash(this.seed * 37 + i * 71));
      this.instances.add(flower);
    }
    this.refresh();
  }

  protected refresh(): void {
    const growth =
      smooth(0, 1, this.state.growth) *
      smooth(0, 0.3, this.state.health) *
      smooth(0, 1, this.state.bloom);
    this.instances.visible = growth > 0;
    this.instances.children.forEach((flower, index) =>
      flower.scale.setScalar(this.scales[index] * growth),
    );
    const autumn = smooth(0.65, 0.9, this.state.season);
    this.instances.traverse((object) => {
      if (!(object as Mesh).isMesh) return;
      const mesh = object as Mesh;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const standard = material as MeshStandardMaterial;
        const base = standard.userData.baseColor as Color | undefined;
        if (base && this.preset !== 'daisy')
          standard.color.copy(base).lerp(new Color('#b27a38'), autumn);
      }
    });
  }

  protected onFrame(time: number): void {
    this.instances.children.forEach((flower, index) => {
      flower.rotation.z =
        (Math.sin(time * 1.3 + (this.phases[index] ?? 0) * TAU) * 0.7 +
          Math.sin(time * 0.63 + (this.phases[index] ?? 0) * TAU * 1.7) * 0.3) *
        this.state.wind *
        0.08;
    });
  }

  override dispose(): void {
    super.dispose();
    this.disposed = true;
    this.instances.traverse((object) => {
      const mesh = object as {
        geometry?: { dispose: () => void };
        material?: { dispose: () => void } | Array<{ dispose: () => void }>;
      };
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else mesh.material?.dispose();
    });
  }
}
