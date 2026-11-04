import { BufferAttribute, BufferGeometry, Color, Vector3, type MeshStandardMaterial } from 'three';
import { clamp, hash, smooth } from './math';
import type { LifeState } from './lifecycle';

/** Minimal, deliberately public adapter to the vendored generator's stable skeleton. */
export interface Section {
  origin: Vector3;
  radius: number;
}
export interface SkeletonBranch {
  sections: Section[];
  segmentCount: number;
  baseRadius: number;
  parentIndex?: number;
  parentT?: number;
  level?: number;
}
export interface SkeletonLeaf {
  origin: Vector3;
  size: number;
  branchIndex?: number;
  branchT?: number;
  orientation?: import('three').Euler;
}
export interface Skeleton {
  branches: SkeletonBranch[];
  leaves: SkeletonLeaf[];
}
export interface LeafStatus {
  size: number;
  tint: Color;
  detached: boolean;
  drop: number;
}

export function leafDetachTime(id: number, seed: number) {
  return 0.76 + hash(seed * 53 + id * 109) * 0.18;
}
export function leafStatus(
  id: number,
  season: number,
  growth: number,
  health: number,
  evergreen: boolean,
  seed: number,
): LeafStatus {
  const n = hash(seed * 31 + id * 83);
  const n2 = hash(seed * 53 + id * 109);
  const autumnStart = 0.61 + n * 0.14;
  const detach = leafDetachTime(id, seed);
  const emerge = smooth(0.13 + n * 0.08, 0.3 + n * 0.09, season);
  const fall = evergreen ? 1 : season < detach ? 1 : 0;
  const dying = smooth(0.03, 0.45, health); // 1 when healthy, 0 when dead
  const size = Math.max(
    0,
    Math.min(
      1,
      (evergreen ? 1 : emerge * fall) * dying * smooth(0.12 + n * 0.15, 0.65 + n * 0.2, growth),
    ),
  );
  const autumn = evergreen ? 0 : smooth(autumnStart, 0.87, season);
  const green = new Color('#ffffff'); // preserve existing, species-specific texture in summer
  const yellow = new Color('#f0bd4d');
  const orange = new Color('#c86e2d');
  const brown = new Color('#775038');
  const tint = green.lerp(yellow, autumn * (0.75 + 0.25 * n));
  tint.lerp(orange, evergreen ? 0 : smooth(0.77 + n * 0.04, 0.9, season) * (1 - 0.3 * n2));
  tint.lerp(brown, evergreen ? 0 : smooth(0.88, 1, season) * 0.55);
  const drop = clamp((season - detach) / 0.13);
  return { size, tint, detached: !evergreen && season >= detach && growth > 0.2, drop };
}

/**
 * Deform EZ-Tree's original indexed mesh rather than replacing its shape/materials.
 * Ring positions use the actual upstream skeleton layout, without regeneration.
 */
export class BranchGrowth {
  private base: Float32Array;
  private position: BufferAttribute;
  private readonly ranges: {
    start: number;
    age: number;
    end: number;
    ringSize: number;
    ringCount: number;
    centers: Float32Array;
    births: Float32Array;
    parent: number;
    attachment: number;
    progress: number;
    offset: Vector3;
  }[] = [];
  private last = -1;

  constructor(geometry: BufferGeometry, skeleton: Skeleton) {
    this.position = geometry.getAttribute('position') as BufferAttribute;
    this.base = new Float32Array(this.position.array as Float32Array);
    let cursor = 0;
    for (const [id, b] of skeleton.branches.entries()) {
      const ringSize = Math.max(3, b.segmentCount) + 1;
      const ringCount = b.sections.length;
      const count = ringSize * ringCount;
      let age = 0;
      const centers = new Float32Array(ringCount * 3);
      for (let ring = 0; ring < ringCount; ring++) {
        for (let j = 0; j < ringSize - 1; j++) {
          const k = (cursor + ring * ringSize + j) * 3;
          centers[ring * 3] += this.base[k] / (ringSize - 1);
          centers[ring * 3 + 1] += this.base[k + 1] / (ringSize - 1);
          centers[ring * 3 + 2] += this.base[k + 2] / (ringSize - 1);
        }
      }
      const link =
        b.parentIndex !== undefined
          ? { branch: b.parentIndex, t: b.parentT ?? 0 }
          : this.locate(b.sections[0].origin);
      const parent = this.ranges[link.branch];
      if (parent) {
        // Bud break follows establishment of the supporting internode.
        // Invert the parent's smooth elongation curve to determine its birth time.
        let lo = 0,
          hi = 1;
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2;
          if (smooth(0, 1, mid) < link.t) lo = mid;
          else hi = mid;
        }
        age = parent.age + ((parent.end - parent.age) * (lo + hi)) / 2 + 0.05 * (1 - parent.end);
      }
      const end = age + (1 - age) * (id === 0 ? 0.72 : 0.82);
      const births = new Float32Array(ringCount);
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        let lo = 0,
          hi = 1;
        for (let n = 0; n < 20; n++) {
          const mid = (lo + hi) / 2;
          if (smooth(0, 1, mid) < t) lo = mid;
          else hi = mid;
        }
        births[ring] = age + ((end - age) * (lo + hi)) / 2;
      }
      this.ranges.push({
        start: cursor,
        age,
        end,
        ringSize,
        ringCount,
        centers,
        births,
        parent: link.branch,
        attachment: link.t,
        progress: 1,
        offset: new Vector3(),
      });
      cursor += count;
    }
    if (cursor !== this.position.count)
      throw new Error(
        `EZ-Tree geometry layout changed: expected ${cursor} branch vertices; got ${this.position.count}`,
      );
  }
  /** Resolve attachment once, against the mature skeleton. */
  locate(point: Vector3) {
    let best = Infinity,
      branch = -1,
      t = 0;
    const a = new Vector3(),
      b = new Vector3(),
      delta = new Vector3(),
      relative = new Vector3();
    for (let id = 0; id < this.ranges.length; id++) {
      const r = this.ranges[id];
      for (let i = 0; i < r.ringCount - 1; i++) {
        a.fromArray(r.centers, i * 3);
        b.fromArray(r.centers, (i + 1) * 3);
        delta.subVectors(b, a);
        const f = clamp(relative.subVectors(point, a).dot(delta) / (delta.lengthSq() || 1));
        const distance = a.addScaledVector(delta, f).distanceToSquared(point);
        if (distance < best) {
          best = distance;
          branch = id;
          t = (i + f) / (r.ringCount - 1);
        }
      }
    }
    return { branch, t };
  }
  attachment(branch: number, t: number, target: Vector3) {
    const r = this.ranges[branch];
    if (!r) return target.set(0, 0, 0);
    const at = Math.min(t, r.progress) * (r.ringCount - 1);
    const lo = Math.floor(at),
      hi = Math.min(r.ringCount - 1, lo + 1);
    return target
      .fromArray(r.centers, lo * 3)
      .lerp(new Vector3().fromArray(r.centers, hi * 3), at - lo)
      .add(r.offset);
  }
  ready(branch: number, t: number) {
    const r = this.ranges[branch];
    return !r ? 1 : smooth(Math.max(0, t - 0.02), Math.min(1, t + 0.1), r.progress);
  }
  /** Temporary juvenile foliage belongs to active shoots, before the adult crown forms. */
  shootTips() {
    const tips: { position: Vector3; tangent: Vector3; vigor: number }[] = [];
    for (let id = 0; id < this.ranges.length; id++) {
      const b = this.ranges[id];
      const vigor = smooth(0, 0.12, b.progress) * (1 - smooth(0.85, 1, b.progress));
      if (vigor <= 0) continue;
      const position = this.attachment(id, 1, new Vector3());
      const behind = this.attachment(id, Math.max(0, b.progress - 0.04), new Vector3());
      tips.push({ position, tangent: position.clone().sub(behind).normalize(), vigor });
    }
    return tips;
  }
  update(growth: number) {
    if (growth === this.last) return;
    this.last = growth;
    const a = this.position.array as Float32Array;
    for (const b of this.ranges) {
      const progress = smooth(b.age, b.end, growth);
      b.progress = progress;
      b.offset.set(0, 0, 0);
      if (b.parent >= 0) {
        this.attachment(b.parent, b.attachment, b.offset);
        b.offset.sub(new Vector3().fromArray(b.centers));
      }

      for (let ring = 0; ring < b.ringCount; ring++) {
        const t = ring / Math.max(1, b.ringCount - 1);
        // New shoots are thin at the apex. Established wood thickens afterward,
        // rather than inflating every ring to the same radius at once.
        const birth = b.births[ring];
        const established = smooth(birth, birth + (1 - birth) * 0.2, growth);
        const secondary = smooth(birth, 1, growth);
        const thickness = growth >= 1 ? 1 : established * (0.12 + 0.88 * secondary);
        // Collapse rings after the growth front to its position on this same branch.
        const front = clamp(b.progress);
        const targetRing = t <= front ? t : front;
        const left = Math.min(b.ringCount - 1, Math.floor(targetRing * (b.ringCount - 1)));
        const right = Math.min(b.ringCount - 1, left + 1);
        const frac = targetRing * (b.ringCount - 1) - left;
        const c = b.centers;
        const ringOffset = ring * 3;
        const cx = c[ringOffset],
          cy = c[ringOffset + 1],
          cz = c[ringOffset + 2];
        const lo = left * 3,
          hi = right * 3;
        const tx = c[lo] + (c[hi] - c[lo]) * frac;
        const ty = c[lo + 1] + (c[hi + 1] - c[lo + 1]) * frac;
        const tz = c[lo + 2] + (c[hi + 2] - c[lo + 2]) * frac;
        for (let j = 0; j < b.ringSize; j++) {
          const k = (b.start + ring * b.ringSize + j) * 3;
          // Reveal progressively along the original branch while keeping each ring circular.
          a[k] = tx + b.offset.x + (this.base[k] - cx) * thickness;
          a[k + 1] = ty + b.offset.y + (this.base[k + 1] - cy) * thickness;
          a[k + 2] = tz + b.offset.z + (this.base[k + 2] - cz) * thickness;
        }
      }
    }
    this.position.needsUpdate = true;
  }
}

/** Per-leaf transitions on the original batched, alpha-tested leaf cards. */
export class LeafLifecycle {
  private position: BufferAttribute;
  private base: Float32Array;
  private colors: BufferAttribute;
  private opacity: BufferAttribute;
  private verticesPerLeaf: number;
  private readonly seed: number;
  private readonly evergreen: boolean;
  private readonly setMaterialColor: (color: Color) => void;
  private readonly baseMaterialColor: Color;
  readonly skeleton: Skeleton;
  private statuses: LeafStatus[] = [];
  private physicalLeaves?: ReadonlySet<number>;
  setPhysicalLeaves(ids: ReadonlySet<number>) {
    this.physicalLeaves = ids;
  }
  private attachments: { branch: number; t: number; offset: Vector3 }[];

  constructor(
    geometry: BufferGeometry,
    skeleton: Skeleton,
    material: MeshStandardMaterial,
    seed: number,
    evergreen: boolean,
    private branches?: BranchGrowth,
  ) {
    this.position = geometry.getAttribute('position') as BufferAttribute;
    this.base = new Float32Array(this.position.array as Float32Array);
    this.skeleton = skeleton;
    this.seed = seed;
    this.evergreen = evergreen;
    this.attachments = skeleton.leaves.map((leaf) => {
      const link =
        leaf.branchIndex !== undefined && leaf.branchIndex >= 0
          ? { branch: leaf.branchIndex, t: leaf.branchT ?? 0 }
          : (branches?.locate(leaf.origin) ?? { branch: -1, t: 0 });
      const center = branches?.attachment(link.branch, link.t, new Vector3()) ?? leaf.origin;
      return { ...link, offset: leaf.origin.clone().sub(center) };
    });
    this.baseMaterialColor = material.color.clone();
    this.setMaterialColor = (color) => material.color.copy(color);
    const count = skeleton.leaves.length;
    this.verticesPerLeaf = count ? this.position.count / count : 4;
    if (count && !Number.isInteger(this.verticesPerLeaf))
      throw new Error('Leaf buffer layout differs from original EZ-Tree skeleton');
    const colors = new Float32Array(this.position.count * 3).fill(1);
    this.colors = new BufferAttribute(colors, 3);
    geometry.setAttribute('color', this.colors);
    this.opacity = new BufferAttribute(new Float32Array(this.position.count).fill(1), 1);
    geometry.setAttribute('leafOpacity', this.opacity);
    // Preserve the upstream wind shader. Alpha hashing fades individual cards
    // without transparent-mesh sorting or shrinking them into their attachment.
    const upstreamCompile = material.onBeforeCompile;
    material.alphaHash = true;
    material.onBeforeCompile = (shader, renderer) => {
      upstreamCompile.call(material, shader, renderer);
      shader.vertexShader =
        'attribute float leafOpacity; varying float vLeafOpacity;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        'void main() {\nvLeafOpacity = leafOpacity;',
      );
      shader.fragmentShader = 'varying float vLeafOpacity;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphatest_fragment>',
        '#include <alphatest_fragment>\ndiffuseColor.a *= vLeafOpacity;',
      );
    };
    material.customProgramCacheKey = () => 'verdant-leaf-fade-v1';
    material.vertexColors = true;
    material.needsUpdate = true;
  }
  update(state: LifeState) {
    const a = this.position.array as Float32Array;
    const color = this.colors.array as Float32Array;
    const autumn = this.evergreen ? 0 : smooth(0.56, 0.82, state.season);
    const winter = this.evergreen ? 0 : smooth(0.84, 1, state.season);
    const seasonalTint = new Color('#e47b28');
    const materialTint = this.baseMaterialColor.clone().lerp(seasonalTint, autumn * 0.72);
    materialTint.multiplyScalar(1 - winter * 0.35 - (1 - state.health) * 0.2);
    this.setMaterialColor(materialTint);
    this.statuses.length = this.skeleton.leaves.length;
    for (let i = 0; i < this.skeleton.leaves.length; i++) {
      const leaf = this.skeleton.leaves[i];
      const status = leafStatus(
        i,
        state.season,
        this.branches ? 1 : state.growth,
        state.health,
        this.evergreen,
        this.seed,
      );
      let opacity = 1;
      if (this.physicalLeaves && !this.physicalLeaves.has(i) && !this.evergreen) {
        // An explicitly reduced physics budget must not make unrepresented cards pop.
        const detach = leafDetachTime(i, this.seed);
        const before = leafStatus(
          i,
          Math.min(state.season, detach - 1e-7),
          this.branches ? 1 : state.growth,
          state.health,
          this.evergreen,
          this.seed,
        );
        status.size = before.size;
        opacity = 1 - smooth(detach - 0.01, Math.min(1, detach + 0.07), state.season);
        status.detached = false;
      }
      const link = this.attachments[i];
      const ready = this.branches?.ready(link.branch, link.t) ?? 1;
      status.size *= ready;
      status.detached &&= ready > 0.99;
      const anchor = this.branches
        ? this.branches.attachment(link.branch, link.t, new Vector3()).add(link.offset)
        : leaf.origin;
      this.statuses[i] = status;
      for (let j = 0; j < this.verticesPerLeaf; j++) {
        this.opacity.setX(i * this.verticesPerLeaf + j, opacity);
        const k = (i * this.verticesPerLeaf + j) * 3;
        a[k] = anchor.x + (this.base[k] - leaf.origin.x) * status.size;
        a[k + 1] = anchor.y + (this.base[k + 1] - leaf.origin.y) * status.size;
        a[k + 2] = anchor.z + (this.base[k + 2] - leaf.origin.z) * status.size;
        color[k] = status.tint.r;
        color[k + 1] = status.tint.g;
        color[k + 2] = status.tint.b;
      }
    }
    this.position.needsUpdate = true;
    this.colors.needsUpdate = true;
    this.opacity.needsUpdate = true;
  }
  getStatus(i: number) {
    return this.statuses[i];
  }
  getAnchor(i: number, target: Vector3) {
    const link = this.attachments[i];
    return this.branches
      ? this.branches.attachment(link.branch, link.t, target).add(link.offset)
      : target.copy(this.skeleton.leaves[i].origin);
  }
}
