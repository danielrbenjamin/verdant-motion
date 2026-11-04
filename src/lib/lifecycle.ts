import { clamp, smooth } from './math';
export type Phenology = 'deciduous' | 'evergreen' | 'herbaceous';
export interface LifeState {
  season: number;
  growth: number;
  health: number;
  wind: number;
  bloom: number;
}
export const initialState = (): LifeState => ({
  season: 0.48,
  growth: 1,
  health: 1,
  wind: 0.25,
  bloom: 1,
});
/** Normalized year: 0=midwinter, .25=spring, .5=midsummer, .75=autumn, 1=midwinter. */
export function foliageState(season: number, type: Phenology) {
  const s = clamp(season);
  if (type === 'evergreen') return { coverage: 1, autumn: 0, fresh: 0.1, dry: 0 };
  const emerge = smooth(0.14, 0.34, s),
    drop = 1 - smooth(0.69, 0.94, s);
  const coverage = emerge * drop;
  return {
    coverage,
    autumn: smooth(0.59, 0.81, s),
    fresh: 1 - smooth(0.28, 0.49, s),
    dry: smooth(0.79, 0.96, s),
  };
}
export function bloomState(s: number) {
  return smooth(0.19, 0.32, s) * (1 - smooth(0.45, 0.62, s));
}
