import { describe, it, expect } from 'vitest';
import { foliageState } from '../src/lib/lifecycle';
import { Timeline } from '../src/lib/timeline';
describe('season states', () => {
  it('deciduous tree drops foliage in winter', () => {
    expect(foliageState(0, 'deciduous').coverage).toBe(0);
    expect(foliageState(0.5, 'deciduous').coverage).toBe(1);
    expect(foliageState(1, 'deciduous').coverage).toBe(0);
  });
  it('evergreen stays covered', () => {
    expect(foliageState(0.95, 'evergreen').coverage).toBe(1);
  });
});
describe('timeline', () => {
  it('scrubs backward deterministically', () => {
    const obj = {
      v: { season: 0 },
      getState() {
        return { ...this.v };
      },
      setState(n: Record<string, number>) {
        Object.assign(this.v, n);
      },
    };
    const timeline = new Timeline(obj).to({ season: 1 }, 10);
    timeline.seek(8);
    timeline.seek(3);
    const backwards = obj.v.season;
    timeline.seek(3);
    expect(obj.v.season).toBe(backwards);
  });
});
