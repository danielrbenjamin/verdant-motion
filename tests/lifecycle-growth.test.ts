import { describe, it, expect } from 'vitest';
import { leafStatus } from '../src/lib/tree-animation';

describe('individual leaf lifecycle', () => {
  it('is deterministic for the same seed', () => {
    expect(leafStatus(12, 0.8, 1, 1, false, 42)).toEqual(leafStatus(12, 0.8, 1, 1, false, 42));
  });
  it('starts without leaves in winter for deciduous trees', () => {
    expect(leafStatus(12, 0.02, 1, 1, false, 42).size).toBe(0);
  });
  it('has a full canopy at the height of summer', () => {
    expect(leafStatus(12, 0.5, 1, 1, false, 42).size).toBe(1);
  });
  it('transitions deciduous leaves toward warm autumn colors', () => {
    const summer = leafStatus(12, 0.5, 1, 1, false, 42).tint;
    const autumn = leafStatus(12, 0.78, 1, 1, false, 42).tint;
    expect(autumn.getHex()).not.toBe(summer.getHex());
    expect(autumn.r).toBeGreaterThan(autumn.g);
  });
  it('does not shed evergreen leaves for autumn', () => {
    expect(leafStatus(12, 0.87, 1, 1, true, 42).size).toBe(1);
  });
  it('varies leaf fall timing by identity', () => {
    const vals = Array.from({ length: 40 }, (_, id) => leafStatus(id, 0.83, 1, 1, false, 44).size);
    expect(vals).toContain(0);
    expect(vals).toContain(1);
  });
  it('suppresses foliage on dead plants', () => {
    expect(leafStatus(12, 0.5, 1, 0, false, 42).size).toBe(0);
  });
});
