import {
  BufferAttribute,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Mesh,
  type BufferGeometry,
} from 'three';
import { Tree as EZTree, TreePreset } from '@verdant-motion/ez-tree-generator';
import { Plant } from './plant';
import { applyTreeTextures } from './tree-textures';
import { BranchGrowth, LeafLifecycle, type Skeleton } from './tree-animation';
import { smooth } from './math';
import { foliageState } from './lifecycle';
import { LeafFlight } from './leaf-physics';
import { LeafReleaseClock } from './leaf-release-clock';
import { leafDetachTime } from './tree-animation';

export const TREE_PRESETS: string[] = Object.keys(TreePreset);
export type TreePresetName = string;
export interface TreeConfig {
  preset?: TreePresetName;
  seed?: number;
  /** Use built-in LOD for non-growing/static scenes. Dynamic growth requires full geometry. */
  lod?: boolean;
  /** Optional physical-card budget. Defaults to every leaf. */
  fallingLeaves?: number;
  /** False keeps mature branch geometry while seasonal foliage still animates. */
  proceduralGrowth?: boolean;
}

/**
 * Uses the local EZ Tree generator workspace, bark maps, leaf textures
 * and wind shader. Seasons operate on the ORIGINAL batched leaf geometry instead
 * of substituting untextured rectangles. Branch geometry is updated in place.
 */
export class Tree extends Plant {
  readonly source: EZTree;
  readonly preset: string;
  readonly seed: number;
  private readonly evergreen: boolean;
  private branches?: BranchGrowth;
  private leaves?: LeafLifecycle;
  private readonly falling: InstancedMesh;
  private readonly juvenile: InstancedMesh;
  private readonly fallingIndices: number[] = [];
  private readonly fallingDummy = new Object3D();
  private flights = new Map<number, LeafFlight>();
  private airborne = 0;
  get hasFallingLeaves() {
    return this.airborne > 0;
  }
  private flightGrowth = -1;
  private releaseClock = new LeafReleaseClock();
  private lastFrameTime?: number;
  private readonly dynamic: boolean;
  private readonly proceduralGrowth: boolean;

  constructor(config: TreeConfig = {}) {
    super();
    this.name = 'VerdantTree';
    this.preset = config.preset ?? 'Oak Large';
    this.seed = config.seed ?? 42;
    if (!TREE_PRESETS.includes(this.preset)) throw new Error(`Unknown tree preset: ${this.preset}`);
    this.evergreen = /pine/i.test(this.preset);
    this.dynamic = !config.lod;
    this.proceduralGrowth = config.proceduralGrowth ?? true;
    if (config.lod && config.proceduralGrowth)
      throw new Error('Procedural growth requires lod: false');

    this.source = new EZTree();
    // Loading the preset directly avoids generating a texture-less tree first.
    const preset = structuredClone(TreePreset[this.preset as keyof typeof TreePreset]);
    // Upstream defines copy(source: TreeOptions), even though TreePreset contains
    // plain data objects. The copy implementation accepts those data fields.
    this.source.options.copy(preset as unknown as Parameters<typeof this.source.options.copy>[0]);
    this.source.options.seed = this.seed;
    applyTreeTextures(this.source);
    if (this.dynamic) this.source.generate();
    else this.source.generateLODs();
    this.add(this.source);

    if (this.dynamic) {
      const skeleton = this.source.skeleton as Skeleton;
      if (this.proceduralGrowth)
        this.branches = new BranchGrowth(
          this.source.branchesMesh.geometry as BufferGeometry,
          skeleton,
        );
      this.leaves = new LeafLifecycle(
        this.source.leavesMesh.geometry as BufferGeometry,
        skeleton,
        this.source.leavesMesh.material as MeshStandardMaterial,
        this.seed,
        this.evergreen,
        this.proceduralGrowth ? this.branches : undefined,
      );
    }

    const availableLeaves = this.leaves?.skeleton.leaves.length ?? 0;
    const max =
      this.evergreen || !this.dynamic || availableLeaves === 0
        ? 0
        : Math.max(
            0,
            Math.min(availableLeaves, Math.floor(config.fallingLeaves ?? availableLeaves)),
          );
    const textureMaterial = this.source.leavesMesh.material as MeshStandardMaterial;
    const dropMaterial = new MeshStandardMaterial({
      name: 'falling-leaves',
      map: textureMaterial.map ?? null,
      color: textureMaterial.color.clone(),
      side: DoubleSide,
      alphaTest: textureMaterial.alphaTest,
      roughness: 1,
      metalness: 0,
      depthWrite: true,
    });
    const plane = new PlaneGeometry(1, 1);
    plane.translate(0, 0.5, 0);
    const fallingGeometry = plane.clone();
    if (this.source.options.leaves.billboard === 'double') {
      const crossed = plane.clone().rotateY(Math.PI / 2);
      const position = new Float32Array([
        ...plane.getAttribute('position').array,
        ...crossed.getAttribute('position').array,
      ]);
      const normal = new Float32Array([
        ...plane.getAttribute('normal').array,
        ...crossed.getAttribute('normal').array,
      ]);
      const uv = new Float32Array([
        ...plane.getAttribute('uv').array,
        ...crossed.getAttribute('uv').array,
      ]);
      fallingGeometry.setAttribute('position', new BufferAttribute(position, 3));
      fallingGeometry.setAttribute('normal', new BufferAttribute(normal, 3));
      fallingGeometry.setAttribute('uv', new BufferAttribute(uv, 2));
      fallingGeometry.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
      crossed.dispose();
    }
    this.falling = new InstancedMesh(fallingGeometry, dropMaterial, max);
    this.falling.name = 'DetachedLeaves';
    this.falling.count = max;
    this.falling.frustumCulled = false;
    this.falling.castShadow = true;
    this.add(this.falling);

    const juvenileMaterial = dropMaterial.clone();
    juvenileMaterial.color.copy(textureMaterial.color);
    this.juvenile = new InstancedMesh(
      plane.clone(),
      juvenileMaterial,
      this.branches ? (this.source.skeleton as Skeleton).branches.length * 2 : 0,
    );
    this.juvenile.frustumCulled = false;
    this.juvenile.castShadow = true;
    this.add(this.juvenile);
    plane.dispose();

    const numLeaves = this.leaves?.skeleton.leaves.length ?? 0;
    for (let i = 0; i < max; i++) {
      // Stratified indices avoid drawing several detached cards for the same leaf.
      this.fallingIndices.push(Math.floor((i * numLeaves) / max));
    }
    this.leaves?.setPhysicalLeaves(new Set(this.fallingIndices));
    this.refresh();
  }

  protected refresh(): void {
    if (this.dynamic) {
      this.branches?.update(this.proceduralGrowth ? this.state.growth : 1);
      this.leaves?.update(this.proceduralGrowth ? this.state : { ...this.state, growth: 1 });
    } else {
      // EZ-Tree native LOD is optimized for fully mature trees.
      this.source.scale.setScalar(
        this.proceduralGrowth ? 0.04 + 0.96 * Math.pow(this.state.growth, 0.8) : 1,
      );
    }
    this.updateShoots();
    this.updateFalling();
  }

  private updateShoots(): void {
    this.juvenile.visible = !!this.branches && this.state.growth > 0 && this.state.growth < 1;
    if (!this.juvenile.visible || !this.branches) return;
    const coverage = foliageState(
      this.state.season,
      this.evergreen ? 'evergreen' : 'deciduous',
    ).coverage;
    const size = this.source.options.leaves.size * 0.55 * coverage * this.state.health;
    const dummy = this.fallingDummy,
      up = new Vector3(0, 1, 0);
    let count = 0;
    for (const tip of this.branches.shootTips()) {
      for (const side of [-1, 1]) {
        dummy.position.copy(tip.position);
        dummy.quaternion.setFromUnitVectors(up, tip.tangent);
        dummy.rotateY(count * 2.4);
        dummy.rotateZ(side * 0.8);
        dummy.scale.setScalar(size * tip.vigor * smooth(0, 0.03, this.state.growth));
        dummy.updateMatrix();
        this.juvenile.setMatrixAt(count++, dummy.matrix);
      }
    }
    this.juvenile.count = count;
    this.juvenile.instanceMatrix.needsUpdate = true;
    (this.juvenile.material as MeshStandardMaterial).color.copy(
      (this.source.leavesMesh.material as MeshStandardMaterial).color,
    );
  }

  private updateFalling(): void {
    this.airborne = 0;
    const skeleton = this.leaves?.skeleton;
    if (!skeleton || !this.fallingIndices.length) return;
    this.releaseClock.setSeason(this.state.season);
    const growth = this.proceduralGrowth ? this.state.growth : 1;
    if (this.flightGrowth !== growth) {
      this.flights.clear();
      this.flightGrowth = growth;
    }
    const dummy = this.fallingDummy;
    (this.falling.material as MeshStandardMaterial).color.copy(
      (this.source.leavesMesh.material as MeshStandardMaterial).color,
    );
    this.falling.visible = this.state.season > 0.75 && growth > 0;
    if (!this.falling.visible) return;
    for (let i = 0; i < this.fallingIndices.length; i++) {
      const id = this.fallingIndices[i],
        leaf = skeleton.leaves[id];
      const status = this.leaves!.getStatus(id);
      const age = this.releaseClock.age(id, leafDetachTime(id, this.seed));
      if (!status?.detached || age < 0) {
        dummy.scale.setScalar(0);
      } else {
        let flight = this.flights.get(id);
        if (!flight) {
          const rotation = leaf.orientation
            ? new Quaternion().setFromEuler(leaf.orientation)
            : new Quaternion();
          const center = this.leaves!.getAnchor(id, new Vector3()).add(
            new Vector3(0, leaf.size * 0.5, 0).applyQuaternion(rotation),
          );
          flight = new LeafFlight({
            origin: center,
            rotation,
            size: leaf.size,
            wind: this.state.wind,
            seed: id * 73 + this.seed,
          });
          this.flights.set(id, flight);
        }
        flight.sample(age, dummy.position, dummy.quaternion);
        if (!flight.hasLanded(age)) this.airborne++;
        dummy.position.sub(new Vector3(0, leaf.size * 0.5, 0).applyQuaternion(dummy.quaternion));
        dummy.scale.setScalar(leaf.size);
        this.falling.setColorAt(i, status.tint);
      }
      dummy.updateMatrix();
      this.falling.setMatrixAt(i, dummy.matrix);
    }
    this.falling.instanceMatrix.needsUpdate = true;
    if (this.falling.instanceColor) this.falling.instanceColor.needsUpdate = true;
  }

  protected onFrame(_time: number): void {
    const delta =
      this.lastFrameTime === undefined ? 0 : Math.max(0, Math.min(0.1, _time - this.lastFrameTime));
    this.lastFrameTime = _time;
    this.releaseClock.advance(delta);
    this.updateFalling();
    this.source.update(_time);
    const leafMaterial = this.source.leavesMesh.material as MeshStandardMaterial;
    const shader = (
      leafMaterial.userData as { shader?: { uniforms?: Record<string, { value: unknown }> } }
    ).shader;
    const wind = shader?.uniforms?.uWindStrength?.value;
    if (wind instanceof Vector3) wind.set(0.65 * this.state.wind, 0, 0.65 * this.state.wind);
    // The render step interpolates cached 120 Hz physical states, including when season playback is paused.
  }

  override dispose(): void {
    super.dispose();
    this.falling.geometry.dispose();
    (this.falling.material as MeshStandardMaterial).dispose();
    this.juvenile.geometry.dispose();
    (this.juvenile.material as MeshStandardMaterial).dispose();
    this.source.traverse((obj) => {
      if ((obj as Mesh).isMesh && obj !== this.falling) {
        const mesh = obj as Mesh;
        mesh.geometry.dispose();
        // Maps are shared and cached by the loader; do not dispose textures here.
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
  }
}
