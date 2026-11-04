/** One real-time clock for release events. Seasonal edits seek; playback never accelerates flights. */
export class LeafReleaseClock {
  private time = 0;
  private season?: number;
  private releases = new Map<number, number>();
  setSeason(season: number) {
    if (
      this.season !== undefined &&
      (season < this.season || Math.abs(season - this.season) > 0.02)
    ) {
      this.releases.clear();
    }
    this.season = season;
  }
  advance(delta: number) {
    this.time += Math.max(0, delta);
  }
  age(id: number, detachSeason: number) {
    if (this.season === undefined || this.season < detachSeason) return -1;
    let release = this.releases.get(id);
    if (release === undefined) {
      release = this.time - (this.season - detachSeason) * 18;
      this.releases.set(id, release);
    }
    return this.time - release;
  }
}
