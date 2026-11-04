import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { BranchGrowth, type Skeleton } from '../src/lib/tree-animation';

/** Four vertices per ring: three radial segments and the UV seam duplicate. */
function fixture() {
  const raw = new Float32Array([
    1, 0, 0, -0.5, 0, 0.866, -0.5, 0, -0.866, 1, 0, 0, 1, 2, 0, -0.5, 2, 0.866, -0.5, 2, -0.866, 1,
    2, 0,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(raw.slice(), 3));
  const skeleton: Skeleton = {
    branches: [
      {
        segmentCount: 3,
        baseRadius: 1,
        sections: [
          { origin: new Vector3(0, 0, 0), radius: 1 },
          { origin: new Vector3(0, 2, 0), radius: 1 },
        ],
      },
    ],
    leaves: [],
  };
  return { geometry, skeleton, original: raw };
}

describe('branch growth vertex offsets', () => {
  it('deforms the geometry without accessing an undefined index', () => {
    const { geometry, skeleton, original } = fixture();
    const growth = new BranchGrowth(geometry, skeleton);
    growth.update(0);
    const positions = geometry.getAttribute('position') as BufferAttribute;
    expect(positions.getY(4)).toBeLessThan(2);
    growth.update(1);
    for (let i = 0; i < positions.array.length; i++) {
      expect(Number(positions.array[i])).toBeCloseTo(original[i], 3);
    }
  });
});

it('thickens established wood without stretching or translating it', () => {
  const { geometry, skeleton } = fixture();
  const growth = new BranchGrowth(geometry, skeleton);
  growth.update(0.8);
  const positions = geometry.getAttribute('position');
  const establishedTip = positions.getY(4);
  const earlyRadius = positions.getX(0);
  growth.update(0.9);
  expect(positions.getY(4)).toBeCloseTo(establishedTip, 6);
  expect(positions.getX(0)).toBeGreaterThan(earlyRadius);
  expect(positions.getX(0)).toBeLessThan(1);
});

it('provides juvenile foliage on active shoots, then retires it at maturity', () => {
  const { geometry, skeleton } = fixture();
  const growth = new BranchGrowth(geometry, skeleton);
  growth.update(0.1);
  const tips = growth.shootTips();
  expect(tips).toHaveLength(1);
  expect(tips[0].vigor).toBeGreaterThan(0);
  expect(tips[0].position.y).toBeGreaterThan(0);
  expect(tips[0].position.y).toBeLessThan(2);
  growth.update(1);
  expect(growth.shootTips()).toHaveLength(0);
});
