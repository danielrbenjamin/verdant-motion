import { expect, it } from 'vitest';
import { advanceSeason } from '../src/demo/season-playback';
it('reaches the end of winter before wrapping even with a large frame', () => {
  expect(advanceSeason(0.99, 0.04, false)).toBe(1);
});
it('waits as long as leaves remain airborne, then loops', () => {
  let season = 1;
  for (let i = 0; i < 1000; i++) season = advanceSeason(season, 1 / 60 / 18, true);
  expect(season).toBe(1);
  expect(advanceSeason(season, 0.001, false)).toBeCloseTo(0.001);
});
it('allows deliberate reverse playback during the winter hold', () => {
  expect(advanceSeason(1, -0.01, true)).toBeCloseTo(0.99);
});
