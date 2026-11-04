import { clamp } from './math';
export type Ease = 'linear' | 'easeInOut' | 'easeOut';
export interface AnimateOptions {
  duration?: number;
  easing?: Ease;
}
type Animatable = {
  setState(values: Record<string, number>): void;
  getState(): Record<string, number>;
};
interface Segment {
  from: Record<string, number>;
  to: Record<string, number>;
  start: number;
  end: number;
  ease: Ease;
}
const ease = (x: number, name: Ease) =>
  name === 'easeInOut' ? x * x * (3 - 2 * x) : name === 'easeOut' ? 1 - (1 - x) ** 3 : x;
/** Time is in seconds. Deterministic seeks; does not require sequential update(). */
export class Timeline {
  private segments: Segment[] = [];
  duration = 0;
  currentTime = 0;
  playing = false;
  private looping = false;
  speed = 1;
  constructor(
    private readonly target: Animatable,
    options: { loop?: boolean } = {},
  ) {
    this.looping = !!options.loop;
  }
  to(values: Record<string, number>, duration = 2, easing: Ease = 'easeInOut'): this {
    const from = this.segments.length
      ? { ...this.segments[this.segments.length - 1].to }
      : { ...this.target.getState() };
    const to = { ...from, ...values };
    this.segments.push({
      from,
      to,
      start: this.duration,
      end: this.duration + Math.max(duration, 0.001),
      ease: easing,
    });
    this.duration += Math.max(duration, 0.001);
    return this;
  }
  seek(t: number): this {
    this.currentTime = clamp(t, 0, this.duration);
    const segment = this.segments.find((s) => this.currentTime <= s.end) ?? this.segments.at(-1);
    if (!segment) return this;
    const a = ease(
      clamp((this.currentTime - segment.start) / (segment.end - segment.start)),
      segment.ease,
    );
    const values: Record<string, number> = {};
    for (const key of Object.keys(segment.to))
      values[key] =
        (segment.from[key] ?? segment.to[key]) +
        (segment.to[key] - (segment.from[key] ?? segment.to[key])) * a;
    this.target.setState(values);
    return this;
  }
  seekProgress(progress: number) {
    return this.seek(clamp(progress) * this.duration);
  }
  play() {
    this.playing = true;
    return this;
  }
  pause() {
    this.playing = false;
    return this;
  }
  reverse() {
    this.speed *= -1;
    this.playing = true;
    return this;
  }
  loop(enabled = true) {
    this.looping = enabled;
    return this;
  }
  update(delta: number) {
    if (!this.playing || !this.duration) return;
    let next = this.currentTime + delta * this.speed;
    if (this.looping) next = ((next % this.duration) + this.duration) % this.duration;
    else if (next >= this.duration || next <= 0) {
      next = clamp(next, 0, this.duration);
      this.playing = false;
    }
    this.seek(next);
  }
}
