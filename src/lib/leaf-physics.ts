import { Quaternion, Vector3 } from 'three';
import { hash, TAU } from './math';

interface FlightFrame {
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  spin: Vector3;
  resting: boolean;
}
export interface LeafPhysicsOptions {
  origin: Vector3;
  rotation?: Quaternion;
  seed: number;
  wind: number;
  size: number;
}
const STEP = 1 / 120;
const SAMPLE_RATE = 30;
function pack(f: FlightFrame) {
  return new Float32Array([
    ...f.position.toArray(),
    ...f.rotation.toArray(),
    ...f.velocity.toArray(),
    ...f.spin.toArray(),
    f.resting ? 1 : 0,
  ]);
}
function unpack(f: Float32Array): FlightFrame {
  return {
    position: new Vector3().fromArray(f, 0),
    rotation: new Quaternion().fromArray(f, 3).normalize(),
    velocity: new Vector3().fromArray(f, 7),
    spin: new Vector3().fromArray(f, 10),
    resting: f[13] > 0,
  };
}
const UP = new Vector3(0, 1, 0);
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/** Fixed-step rigid-card approximation. Cached states permit deterministic reverse seeks. */
export class LeafFlight {
  private frames: Float32Array[];
  private normal = new Vector3();
  private air = new Vector3();
  private relative = new Vector3();
  private acceleration = new Vector3();
  private torque = new Vector3();
  private axis = new Vector3();
  private delta = new Quaternion();
  private restingRotation: Quaternion;
  private landingTime = Infinity;
  hasLanded(seconds: number) {
    return seconds >= this.landingTime;
  }
  readonly floor: number;
  constructor(private options: LeafPhysicsOptions) {
    this.restingRotation = new Quaternion()
      .setFromAxisAngle(UP, hash(options.seed * 23) * TAU)
      .multiply(FLAT);
    this.floor = Math.max(0.015, options.size * 0.04);
    this.frames = [
      pack({
        position: options.origin.clone(),
        rotation: options.rotation?.clone() ?? new Quaternion(),
        velocity: new Vector3(),
        spin: new Vector3(
          hash(options.seed * 3) - 0.5,
          hash(options.seed * 7) - 0.5,
          hash(options.seed * 11) - 0.5,
        ).multiplyScalar(0.5),
        resting: false,
      }),
    ];
  }
  private step(previous: FlightFrame, time: number): FlightFrame {
    const p = previous.position.clone(),
      v = previous.velocity.clone();
    const q = previous.rotation.clone(),
      omega = previous.spin.clone();
    if (previous.resting) return previous;
    const phase = hash(this.options.seed) * TAU;
    // Continuous gust field sampled in world space, independent of render frame rate.
    this.air.set(
      this.options.wind * (2.2 + 0.7 * Math.sin(time * 0.8 + p.z * 0.13)),
      this.options.wind * 0.15 * Math.sin(time * 1.7 + phase),
      this.options.wind * (0.6 + 0.5 * Math.sin(time * 0.57 + p.x * 0.11)),
    );
    this.relative.copy(v).sub(this.air);
    this.normal.set(0, 0, 1).applyQuaternion(q);
    const normalSpeed = this.relative.dot(this.normal);
    const speed = this.relative.length();
    // Gravity + quadratic pressure drag on the card normal + weaker edge drag.
    // Area / mass varies by leaf identity; broadside cards descend more slowly.
    const drag = 2.5 + hash(this.options.seed * 17) * 2;
    this.acceleration
      .copy(this.relative)
      .multiplyScalar(-0.25 * speed)
      .addScaledVector(this.normal, -drag * normalSpeed * Math.abs(normalSpeed));
    this.acceleration.y -= 9.81;
    // Off-center pressure produces tumbling, with rotational air damping.
    this.axis.set(Math.cos(phase), Math.sin(phase), 0.1).applyQuaternion(q);
    this.torque
      .crossVectors(this.axis, this.normal)
      .multiplyScalar(normalSpeed * Math.abs(normalSpeed) * 0.08);
    omega.addScaledVector(this.torque, STEP).multiplyScalar(Math.exp(-1.2 * STEP));
    v.addScaledVector(this.acceleration, STEP);
    p.addScaledVector(v, STEP);
    if (omega.lengthSq() > 9) omega.setLength(3);
    const angularSpeed = omega.length();
    if (angularSpeed > 1e-8)
      q.premultiply(
        this.delta.setFromAxisAngle(this.axis.copy(omega).normalize(), angularSpeed * STEP),
      ).normalize();
    let resting = false;
    // An invisible collision plane remains at y=0 even in the ground-free studio.
    const clearance =
      this.floor + this.options.size * 0.55 * Math.sqrt(Math.max(0, 1 - this.normal.y ** 2));
    if (p.y <= clearance) {
      this.landingTime = Math.min(this.landingTime, time);
      p.y = clearance;
      if (v.y < 0) v.y *= -0.12;
      v.x *= Math.exp(-8 * STEP);
      v.z *= Math.exp(-8 * STEP);
      omega.multiplyScalar(Math.exp(-12 * STEP));
      q.slerp(this.restingRotation, 1 - Math.exp(-10 * STEP));
      if (
        v.lengthSq() < 0.015 &&
        omega.lengthSq() < 0.02 &&
        q.angleTo(this.restingRotation) < 0.02
      ) {
        p.y = this.floor;
        q.copy(this.restingRotation);
        v.set(0, 0, 0);
        omega.set(0, 0, 0);
        resting = true;
      }
    }
    return { position: p, rotation: q, velocity: v, spin: omega, resting };
  }
  sample(seconds: number, position: Vector3, rotation: Quaternion) {
    const at = Math.max(0, Math.min(90, seconds)) * SAMPLE_RATE;
    const lo = Math.floor(at),
      hi = lo + 1;
    while (this.frames.length <= hi) {
      let last = unpack(this.frames[this.frames.length - 1]);
      if (last.resting) {
        position.copy(last.position);
        position.y = Math.max(this.floor, position.y);
        rotation.copy(last.rotation);
        return;
      }
      const start = (this.frames.length - 1) / SAMPLE_RATE;
      for (let i = 1; i <= 4; i++) last = this.step(last, start + i * STEP);
      this.frames.push(pack(last));
    }
    const a = unpack(this.frames[lo]),
      b = unpack(this.frames[hi]);
    position.copy(a.position).lerp(b.position, at - lo);
    position.y = Math.max(this.floor, position.y);
    rotation.copy(a.rotation).slerp(b.rotation, at - lo);
  }
}
