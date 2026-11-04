import { describe, expect, it } from 'vitest';
import { Timeline } from '../src/lib/timeline';

const target = () => ({
  state: { season: 0, growth: 1 },
  getState() {
    return { ...this.state };
  },
  setState(v: Record<string, number>) {
    Object.assign(this.state, v);
  },
});

describe('seekable animations', () => {
  it('reproduces the exact same state when scrubbing backward', () => {
    const t = target();
    const timeline = new Timeline(t).to({ season: 0.5 }, 3).to({ season: 1 }, 3);
    timeline.seek(4);
    const saved = t.getState();
    timeline.seek(1);
    timeline.seek(4);
    expect(t.getState()).toEqual(saved);
  });
  it('can play in reverse', () => {
    const t = target();
    const timeline = new Timeline(t).to({ season: 1 }, 2);
    timeline.seek(2).reverse().update(0.5);
    expect(t.state.season).toBeLessThan(1);
    expect(t.state.season).toBeGreaterThan(0);
  });
});
