import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/tree-textures', () => ({ applyTreeTextures: () => {} }));
import { Tree } from '../src/lib/tree';
import { leafDetachTime, type Skeleton } from '../src/lib/tree-animation';

it('fades budgeted-out canopy leaves without shrinking or popping, and supports rewind', () => {
  const tree = new Tree({
    preset: 'Oak Large',
    proceduralGrowth: false,
    fallingLeaves: 1,
    seed: 42,
  });
  const geometry = tree.source.leavesMesh.geometry;
  const count = (tree.source.skeleton as Skeleton).leaves.length;
  const perLeaf = geometry.getAttribute('position').count / count;
  const opacity = geometry.getAttribute('leafOpacity');
  const positions = geometry.getAttribute('position');
  // The one physical replacement is leaf zero; leaf one fades in the canopy.
  const id = 1,
    vertex = id * perLeaf,
    detach = leafDetachTime(id, 42);
  tree.setState({ season: detach - 0.02 });
  const before = Array.from(positions.array).slice(vertex * 3, (vertex + perLeaf) * 3);
  expect(opacity.getX(vertex)).toBe(1);
  tree.setState({ season: detach + 0.03 });
  expect(opacity.getX(vertex)).toBeGreaterThan(0);
  expect(opacity.getX(vertex)).toBeLessThan(1);
  expect(Array.from(positions.array).slice(vertex * 3, (vertex + perLeaf) * 3)).toEqual(before);
  tree.setState({ season: detach + 0.08 });
  expect(opacity.getX(vertex)).toBe(0);
  tree.setState({ season: detach - 0.02 });
  expect(opacity.getX(vertex)).toBe(1);
  tree.dispose();
});
