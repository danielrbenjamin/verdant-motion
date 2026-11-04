import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
vi.mock('../src/lib/tree-textures', () => ({ applyTreeTextures: () => {} }));
import { Tree } from '../src/lib/tree';
import { leafStatus, type Skeleton } from '../src/lib/tree-animation';

describe('canopy to falling-leaf handoff', () => {
  it('provides a falling replacement for every shed leaf by default', () => {
    const tree = new Tree({ preset: 'Oak Large', proceduralGrowth: false, seed: 42 });
    const skeleton = tree.source.skeleton as Skeleton;
    const falling = tree.getObjectByName('DetachedLeaves') as InstancedMesh;
    expect(falling.count).toBe(skeleton.leaves.length);
    tree.setState({ season: 0.84, growth: 1 });
    const matrix = new Matrix4(),
      p = new Vector3(),
      q = new Quaternion(),
      scale = new Vector3();
    let fallingVisible = 0,
      attachedVisible = 0;
    for (let i = 0; i < skeleton.leaves.length; i++) {
      falling.getMatrixAt(i, matrix);
      matrix.decompose(p, q, scale);
      const status = leafStatus(i, 0.84, 1, 1, false, 42);
      if (scale.x > 0) fallingVisible++;
      if (status.size > 0) attachedVisible++;
      expect(scale.x > 0).toBe(status.detached);
    }
    expect(fallingVisible + attachedVisible).toBe(skeleton.leaves.length);
    tree.dispose();
  });
});
