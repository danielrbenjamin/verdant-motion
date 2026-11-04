/** Finish winter and all active flights before a forward season loop wraps. */
export function advanceSeason(season: number, delta: number, airborne: boolean) {
  if (delta <= 0) return (((season + delta) % 1) + 1) % 1;
  if (season < 1 && season + delta >= 1) return 1;
  if (season >= 1 && airborne) return 1;
  return (season + delta) % 1;
}
