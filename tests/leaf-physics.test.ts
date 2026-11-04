import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { LeafFlight } from '../src/lib/leaf-physics';

const flight = (wind = 0, seed = 42) =>
  new LeafFlight({ origin: new Vector3(0, 12, 0), seed, wind, size: 0.5 });
function sample(f: LeafFlight, t: number) {
  const p = new Vector3(),
    q = new Quaternion();
  f.sample(t, p, q);
  return { p, q };
}
describe('physical leaf trajectories', () => {
  it('starts at the attachment without a position jump', () => {
    expect(sample(flight(), 0).p.toArray()).toEqual([0, 12, 0]);
    expect(sample(flight(), 0.001).p.distanceTo(new Vector3(0, 12, 0))).toBeLessThan(0.001);
  });
  it('accelerates under gravity and air resistance limits descent speed', () => {
    const f = flight();
    expect(sample(f, 0.1).p.y).toBeLessThan(12);
    expect(sample(f, 0.2).p.y).toBeLessThan(sample(f, 0.1).p.y);
    expect(sample(f, 2).p.y).toBeGreaterThan(0);
  });
  it('lands and remains at rest without penetrating the collision plane', () => {
    const f = flight(),
      a = sample(f, 60),
      b = sample(f, 80);
    expect(a.p.y).toBeGreaterThanOrEqual(f.floor);
    expect(a.p.distanceTo(b.p)).toBeLessThan(0.001);
    expect(a.q.angleTo(b.q)).toBeLessThan(0.001);
  });
  it('wind causes drift and rotation stays normalized', () => {
    const calm = sample(flight(), 2),
      windy = sample(flight(1), 2);
    expect(windy.p.x).toBeGreaterThan(calm.p.x);
    expect(windy.q.length()).toBeCloseTo(1, 6);
  });
  it('is deterministic for direct seeks, sequential playback, and backward seeks', () => {
    const direct = sample(flight(0.6), 3.417),
      f = flight(0.6);
    for (let i = 0; i < 206; i++) sample(f, i / 60);
    const stepped = sample(f, 3.417);
    sample(f, 10);
    const reverse = sample(f, 3.417);
    expect(stepped.p.toArray()).toEqual(direct.p.toArray());
    expect(reverse.p.toArray()).toEqual(direct.p.toArray());
    expect(reverse.q.toArray()).toEqual(direct.q.toArray());
  });
  it('remains finite across leaf identities and strong wind', () => {
    for (let seed = 1; seed < 12; seed++) {
      const { p, q } = sample(flight(1, seed), 40);
      expect([...p.toArray(), ...q.toArray()].every(Number.isFinite)).toBe(true);
    }
  });
});
