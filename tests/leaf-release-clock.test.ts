import { describe, it, expect } from 'vitest';
import { LeafReleaseClock } from '../src/lib/leaf-release-clock';

describe('leaf release timing', () => {
  it('advances flights in real seconds during seasonal playback', () => {
    const clock = new LeafReleaseClock();
    clock.setSeason(0.8);
    const before = clock.age(0, 0.8);
    for (let i = 1; i <= 60; i++) {
      clock.advance(1 / 60);
      clock.setSeason(0.8 + i / 60 / 18);
      clock.age(0, 0.8);
    }
    expect(clock.age(0, 0.8) - before).toBeCloseTo(1, 8);
  });
  it('does not rewind when resuming after a pause', () => {
    const clock = new LeafReleaseClock();
    clock.setSeason(0.8);
    clock.age(0, 0.8);
    clock.advance(2);
    const paused = clock.age(0, 0.8);
    clock.setSeason(0.801);
    expect(clock.age(0, 0.8)).toBe(paused);
  });
  it('waits for each individual detachment and restores earlier states on rewind', () => {
    const clock = new LeafReleaseClock();
    clock.setSeason(0.79);
    expect(clock.age(1, 0.8)).toBe(-1);
    clock.setSeason(0.801);
    expect(clock.age(1, 0.8)).toBeCloseTo(0.018);
    clock.advance(1);
    clock.setSeason(0.79);
    expect(clock.age(1, 0.8)).toBe(-1);
    clock.setSeason(0.801);
    expect(clock.age(1, 0.8)).toBeCloseTo(0.018);
  });
  it('seeks large seasonal edits without retaining the previous flight age', () => {
    const clock = new LeafReleaseClock();
    clock.setSeason(0.8);
    clock.age(1, 0.8);
    clock.advance(20);
    clock.setSeason(0.95);
    expect(clock.age(1, 0.8)).toBeCloseTo(2.7);
  });
});
