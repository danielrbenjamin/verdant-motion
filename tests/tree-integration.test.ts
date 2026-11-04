import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { Tree, TreePreset } from '@verdant-motion/ez-tree-generator';
import { BranchGrowth, LeafLifecycle, leafStatus, type Skeleton } from '../src/lib/tree-animation';

describe('growth on real EZ Tree geometry', () => {
  for (const preset of Object.keys(TreePreset)) {
    it(`${preset}: remains finite, restores the mature tree, and supports backward seeks`, () => {
      const tree = new Tree();
      tree.options.copy(
        structuredClone(TreePreset[preset as keyof typeof TreePreset]) as unknown as Parameters<
          typeof tree.options.copy
        >[0],
      );
      tree.generate();
      const geometry = tree.branchesMesh.geometry;
      const foliage = tree.leavesMesh.geometry;
      const original = new Float32Array(geometry.getAttribute('position').array);
      const originalLeaves = new Float32Array(foliage.getAttribute('position').array);
      const skeleton = tree.skeleton as Skeleton;
      for (let i = 1; i < skeleton.branches.length; i++) {
        const branch = skeleton.branches[i];
        expect(branch.parentIndex).toBeGreaterThanOrEqual(0);
        expect(branch.parentIndex).toBeLessThan(i);
        const parent = skeleton.branches[branch.parentIndex!];
        const at = branch.parentT! * (parent.sections.length - 1),
          lo = Math.floor(at);
        const anchor = parent.sections[lo].origin
          .clone()
          .lerp(parent.sections[Math.min(lo + 1, parent.sections.length - 1)].origin, at - lo);
        expect(anchor.distanceTo(branch.sections[0].origin)).toBeLessThan(0.00001);
      }
      for (const leaf of skeleton.leaves) expect(leaf.branchIndex).toBeGreaterThanOrEqual(0);
      const branches = new BranchGrowth(geometry, skeleton);
      const leaves = new LeafLifecycle(
        foliage,
        skeleton,
        tree.leavesMesh.material as MeshStandardMaterial,
        42,
        /Pine/.test(preset),
        branches,
      );
      const update = (growth: number) => {
        branches.update(growth);
        leaves.update({ growth, season: 0.5, health: 1, wind: 0, bloom: 1 });
      };
      update(0.4);
      const snapshot = new Float32Array(geometry.getAttribute('position').array);
      update(1);
      update(0);
      update(0.4);
      expect(geometry.getAttribute('position').array).toEqual(snapshot);
      update(0);
      expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      // Unborn child branches collapse back to the root instead of floating in the canopy.
      expect(
        Math.max(...Array.from(geometry.getAttribute('position').array, Math.abs)),
      ).toBeLessThan(0.0001);
      const leafPositions = foliage.getAttribute('position');
      // Every card is collapsed at birth, including those at mature canopy heights.
      const perLeaf = leafPositions.count / skeleton.leaves.length;
      for (let j = 1; j < perLeaf; j++)
        expect(leafPositions.getY(j)).toBeCloseTo(leafPositions.getY(0), 5);
      update(1);
      const positions = geometry.getAttribute('position').array;
      let error = 0;
      for (let i = 0; i < positions.length; i++)
        error = Math.max(error, Math.abs(positions[i] - original[i]));
      expect(error).toBeLessThan(0.0001);
      const finalLeaves = foliage.getAttribute('position').array;
      let leafError = 0;
      for (let i = 0; i < finalLeaves.length; i++)
        leafError = Math.max(leafError, Math.abs(finalLeaves[i] - originalLeaves[i]));
      expect(leafError).toBeLessThan(0.0001);
    });
  }
  it('keeps evergreen foliage green in late autumn and winter', () => {
    expect(leafStatus(12, 0.95, 1, 1, true, 42).tint.getHex()).toBe(0xffffff);
  });
});
