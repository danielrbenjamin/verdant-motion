import { Group } from 'three';
import { Plant } from './plant';
import { Tree, type TreeConfig } from './tree';
import { Grass, type GrassConfig } from './grass';
import { Flower, type FlowerConfig } from './flower';
import { Timeline, type AnimateOptions } from './timeline';
import { initialState, type LifeState } from './lifecycle';
import { clamp } from './math';
export class Nature extends Group {
  readonly plants: Plant[] = [];
  state: LifeState = initialState();
  private timelines = new Set<Timeline>();
  constructor() {
    super();
    this.name = 'VerdantNature';
  }
  addPlant<T extends Plant>(p: T): T {
    this.plants.push(p);
    p.setState(this.state);
    this.add(p);
    return p;
  }
  addTree(c: TreeConfig = {}) {
    return this.addPlant(new Tree(c));
  }
  addGrass(c: GrassConfig = {}) {
    return this.addPlant(new Grass(c));
  }
  addFlower(c: FlowerConfig = {}) {
    return this.addPlant(new Flower(c));
  }
  setState(v: Partial<LifeState> | Record<string, number>) {
    for (const [k, n] of Object.entries(v))
      if (k in this.state && Number.isFinite(n))
        (this.state as unknown as Record<string, number>)[k] = clamp(n);
    for (const p of this.plants) p.setState(v);
    return this;
  }
  getState(): Record<string, number> {
    return { ...this.state };
  }
  timeline(options: { loop?: boolean } = {}) {
    const t = new Timeline(this, options);
    this.timelines.add(t);
    return t;
  }
  animate(v: Partial<LifeState>, o: AnimateOptions = {}) {
    return this.timeline()
      .to(v, (o.duration ?? 2000) / 1000, o.easing ?? 'easeInOut')
      .play();
  }
  update(delta: number, absolute: number) {
    for (const timeline of this.timelines) timeline.update(delta);
    for (const plant of this.plants) plant.update(delta, absolute);
  }
  dispose() {
    for (const p of this.plants) p.dispose();
    this.timelines.clear();
  }
}
