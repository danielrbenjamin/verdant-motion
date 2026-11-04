import { Group } from 'three';
import { clamp } from './math';
import { initialState, type LifeState } from './lifecycle';
import { Timeline, type AnimateOptions } from './timeline';
export abstract class Plant extends Group {
  state: LifeState = initialState();
  private activeTimelines = new Set<Timeline>();
  setState(values: Partial<LifeState> | Record<string, number>) {
    for (const [key, value] of Object.entries(values))
      if (key in this.state && Number.isFinite(value))
        (this.state as unknown as Record<string, number>)[key] = clamp(value);
    this.refresh();
    return this;
  }
  getState(): Record<string, number> {
    return { ...this.state };
  }
  get season() {
    return this.state.season;
  }
  set season(n: number) {
    this.setState({ season: n });
  }
  get growth() {
    return this.state.growth;
  }
  set growth(n: number) {
    this.setState({ growth: n });
  }
  get health() {
    return this.state.health;
  }
  set health(n: number) {
    this.setState({ health: n });
  }
  get wind() {
    return this.state.wind;
  }
  set wind(n: number) {
    this.setState({ wind: n });
  }
  timeline(options: { loop?: boolean } = {}) {
    const t = new Timeline(this, options);
    this.activeTimelines.add(t);
    return t;
  }
  animate(values: Partial<LifeState>, options: AnimateOptions = {}) {
    const timeline = this.timeline();
    timeline.to(values, (options.duration ?? 2000) / 1000, options.easing ?? 'easeInOut').play();
    return timeline;
  }
  /** delta in seconds, absolute time in seconds */
  update(delta: number, absoluteTime: number) {
    for (const t of this.activeTimelines) t.update(delta);
    this.onFrame(absoluteTime);
  }
  protected abstract refresh(): void;
  protected onFrame(_time: number): void {}
  dispose() {
    this.activeTimelines.clear();
  }
}
