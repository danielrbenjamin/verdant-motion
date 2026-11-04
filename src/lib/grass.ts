import {
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Plant } from './plant';
import { assetUrl } from './assets';
import { hash, smooth, TAU } from './math';

export type GrassPreset = 'meadow' | 'fescue' | 'reed';
export interface GrassConfig {
  preset?: GrassPreset;
  count?: number;
  size?: number;
  area?: [number, number];
  seed?: number;
  color?: string;
}

const loader = new GLTFLoader();
const models = new Map<string, ReturnType<GLTFLoader['loadAsync']>>();
function loadModel() {
  const path = assetUrl('models/grass.glb');
  if (!models.has(path)) models.set(path, loader.loadAsync(path));
  return models.get(path)!;
}
const PRESET_SCALE: Record<GrassPreset, Vector3> = {
  meadow: new Vector3(5, 4, 5),
  fescue: new Vector3(3.5, 2.8, 3.5),
  reed: new Vector3(5.5, 6, 5.5),
};

function findMesh(root: Object3D): Mesh {
  let result: Mesh | undefined;
  root.traverse((object) => {
    if (!result && (object as Mesh).isMesh) result = object as Mesh;
  });
  if (!result) throw new Error('EZ-Tree grass.glb does not contain a mesh');
  return result;
}

export class Grass extends Plant {
  private mesh?: InstancedMesh;
  private material?: MeshStandardMaterial;
  private readonly count: number;
  private readonly size: number;
  private readonly area: [number, number];
  private readonly seed: number;
  private readonly preset: GrassPreset;
  private readonly baseColor: Color;
  private readonly dummy = new Object3D();
  private disposed = false;
  private shader?: { uniforms: Record<string, { value: unknown }> };

  constructor(config: GrassConfig = {}) {
    super();
    this.name = 'VerdantGrass';
    this.count = Math.max(0, Math.floor(config.count ?? 5000));
    this.size = Math.max(0.05, config.size ?? 1);
    this.area = config.area ?? [1000, 1000];
    this.seed = config.seed ?? 7;
    this.preset = config.preset ?? 'meadow';
    this.baseColor = new Color(config.color ?? '#4d7838');
    loadModel()
      .then((model) => this.initialize(findMesh(model.scene)))
      .catch((error) => {
        console.error('[Verdant Motion] Failed to load EZ-Tree grass model.', error);
      });
  }

  private initialize(source: Mesh | BufferGeometry): void {
    if (this.disposed) return;
    const sourceMesh = source instanceof Object3D ? (source as Mesh) : undefined;
    const sourceMaterial = sourceMesh
      ? ((Array.isArray(sourceMesh.material)
          ? sourceMesh.material[0]
          : sourceMesh.material) as MeshStandardMaterial)
      : undefined;
    const material = new MeshStandardMaterial({
      map: sourceMaterial?.map ?? null,
      color: this.baseColor.clone().multiplyScalar(0.72),
      emissive: new Color('#308040'),
      emissiveIntensity: 0.05,
      alphaTest: 0.5,
      depthWrite: true,
      metalness: 0,
      roughness: 1,
      side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uGrowth = { value: this.state.growth };
      shader.uniforms.uWindStrength = { value: 0.3 };
      shader.uniforms.uWindFrequency = { value: 1 };
      this.shader = shader;
      shader.vertexShader = `uniform float uTime; uniform float uGrowth; uniform float uWindStrength; uniform float uWindFrequency;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position) * smoothstep(0., 1., uGrowth);
        vec3 anchor = vec3(0.);
        #ifdef USE_INSTANCING
          anchor = instanceMatrix[3].xyz;
        #endif
        float phase = anchor.x * .17 + anchor.z * .13;
        float wind = sin(uTime * uWindFrequency + phase) * .65
          + sin(uTime * uWindFrequency * 1.7 + phase * 1.3) * .25
          + sin(uTime * uWindFrequency * .43 + phase * .7) * .1;
        float bend = uv.y * uv.y * uWindStrength;
        transformed.x += bend * wind;
        transformed.z += bend * cos(uTime * uWindFrequency * .8 + phase) * .7;
      `,
      );
    };
    this.material = material;
    const geometry: BufferGeometry = sourceMesh ? sourceMesh.geometry : (source as BufferGeometry);
    this.mesh = new InstancedMesh(geometry, material, this.count);
    this.mesh.count = this.count;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.add(this.mesh);

    const radius = Math.max(2, Math.min(...this.area) * 0.5);
    const scale = PRESET_SCALE[this.preset].clone().multiplyScalar(this.size);
    for (let i = 0; i < this.count; i++) {
      const angle = hash(this.seed * 5 + i * 53) * TAU;
      const inner = Math.min(10, radius * 0.1);
      const distance = Math.sqrt(
        inner * inner + hash(this.seed * 11 + i * 89) * (radius * radius - inner * inner),
      );
      this.dummy.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      this.dummy.rotation.set(0, hash(this.seed * 73 + i * 17) * TAU, 0);
      const variation = 0.8 + hash(this.seed * 31 + i * 113) * 0.4;
      this.dummy.scale.copy(scale).multiplyScalar(variation);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new Color().setScalar(0.65 + hash(i * 7 + this.seed) * 0.45));
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.refresh();
  }

  protected refresh(): void {
    const seasonal =
      smooth(0.16, 0.42, this.state.season) * (1 - smooth(0.72, 0.99, this.state.season));
    this.material?.color
      .copy(new Color('#ad934e').lerp(this.baseColor, seasonal * this.state.health))
      .multiplyScalar(0.72);
  }

  protected onFrame(time: number): void {
    const uniforms = this.shader?.uniforms;
    if (uniforms) {
      uniforms.uTime.value = time;
      uniforms.uGrowth.value = this.state.growth;
      uniforms.uWindStrength.value = this.state.wind * 0.3;
    }
    if (this.mesh) this.mesh.visible = this.state.growth > 0;
  }

  override dispose(): void {
    super.dispose();
    this.disposed = true;
    // Geometry belongs to the cached GLTF source and is shared by grass fields.
    this.material?.dispose();
  }
}
